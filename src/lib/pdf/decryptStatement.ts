"use client";

// Client-only helper: unlock and rasterise a password-protected bank-statement
// PDF entirely in the browser, so the PDF password never leaves the device.
//
// Why rasterise at all: Anthropic's document API rejects ANY encrypted PDF — both
// the "you need a password to open it" kind and the "opens fine but is owner-
// locked against copy/print" kind that several SA banks use. pdf.js can open both
// (given the password for the first), but it can't hand back a decrypted PDF — so
// we render each page to a JPEG and send those instead. Unencrypted PDFs never
// reach this file; the caller sends them to the API untouched.

// pdfjs is ~2MB, so it's imported lazily and only for the rare encrypted
// statement. The legacy build is used deliberately: it's transpiled/polyfilled
// for the older Android phones common in this user base. The worker is a version-
// matched copy committed at public/pdf.worker.min.mjs. On a version bump, re-copy
// node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs into public/ — a worker
// that doesn't match the pinned pdfjs-dist version fails with a version error.
type Pdfjs = typeof import("pdfjs-dist/legacy/build/pdf.mjs");
type PdfDoc = Awaited<ReturnType<Pdfjs["getDocument"]>["promise"]>;

let pdfjsPromise: Promise<Pdfjs> | null = null;
async function getPdfjs(): Promise<Pdfjs> {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist/legacy/build/pdf.mjs").then((lib) => {
      lib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      return lib;
    });
  }
  return pdfjsPromise;
}

// A PDF's /Encrypt entry lives in the trailer dictionary, and PDF encryption only
// ever covers stream and string CONTENT — never the dictionary structure — so this
// marker is present in clear bytes when, and only when, the file is encrypted.
// Scanning for it lets unencrypted PDFs stay on the fast path without ever loading
// pdf.js. A false positive would merely rasterise a file that would also have
// worked natively (harmless); a false negative sends it natively, exactly as today.
export function pdfIsEncrypted(bytes: Uint8Array): boolean {
  const needle = [0x2f, 0x45, 0x6e, 0x63, 0x72, 0x79, 0x70, 0x74]; // "/Encrypt"
  const last = bytes.length - needle.length;
  outer: for (let i = 0; i <= last; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (bytes[i + j] !== needle[j]) continue outer;
    }
    return true;
  }
  return false;
}

export type RenderResult =
  | { status: "ok"; pages: string[]; skipped: number } // base64 JPEGs, no data: prefix
  | { status: "need-password" }
  | { status: "wrong-password" }
  | { status: "too-large" }
  | { status: "failed" };

const MAX_PAGES = 12;
const TARGET_LONG_EDGE = 1500; // Anthropic downsamples past ~1568px; more is waste
const JPEG_QUALITY = 0.7;
// Vercel rejects a request body over ~4.5MB at the edge, before our route runs;
// base64 inflates ~33%, so keep the summed payload comfortably under that.
const MAX_TOTAL_BASE64 = 3_600_000;

export async function renderEncryptedPdf(bytes: Uint8Array, password?: string): Promise<RenderResult> {
  let pdfjsLib: Pdfjs;
  try {
    pdfjsLib = await getPdfjs();
  } catch {
    return { status: "failed" };
  }

  // pdf.js transfers (detaches) the ArrayBuffer to its worker, so every attempt
  // gets its own copy and the caller's original bytes survive for a retry.
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(bytes), password });
  let pdf: PdfDoc;
  try {
    pdf = await loadingTask.promise;
  } catch (err) {
    void loadingTask.destroy().catch(() => {}); // don't leak the worker on failure
    const e = err as { name?: string; code?: number };
    const PR = pdfjsLib.PasswordResponses ?? { NEED_PASSWORD: 1, INCORRECT_PASSWORD: 2 };
    if (e?.name === "PasswordException") {
      if (e.code === PR.NEED_PASSWORD) return { status: "need-password" };
      if (e.code === PR.INCORRECT_PASSWORD) return { status: "wrong-password" };
    }
    return { status: "failed" }; // corrupt, or an encryption pdf.js can't handle
  }

  try {
    // Refuse rather than silently truncate — dropping pages 13+ of a statement
    // would quietly lose transactions from the books.
    if (pdf.numPages > MAX_PAGES) return { status: "too-large" };
    const pages: string[] = [];
    let total = 0;
    let skipped = 0;
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      const unit = page.getViewport({ scale: 1 });
      const longEdge = Math.max(unit.width, unit.height) || TARGET_LONG_EDGE;
      const scale = Math.min(TARGET_LONG_EDGE / longEdge, 3);
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return { status: "failed" };
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      // intent:"print" renders the flattened page appearance and, unlike the
      // default "display" intent, schedules its paint via a microtask rather than
      // requestAnimationFrame — so it completes even when rAF is throttled (a
      // backgrounded mobile tab, an offscreen webview). Right for a static raster.
      await page.render({ canvas, canvasContext: ctx, viewport, intent: "print" }).promise;

      // iOS silently returns a blank canvas once past its area/memory cap; sending
      // white pages would waste a model call and confuse the user. Sample first.
      const blank = isBlankCanvas(ctx, canvas.width, canvas.height);
      const dataUrl = blank ? "" : canvas.toDataURL("image/jpeg", JPEG_QUALITY);
      page.cleanup();
      canvas.width = 0; // release the backing store before the next page
      canvas.height = 0;

      // Skip a blank render rather than aborting: it's usually a genuinely empty
      // page. If it happens to EVERY page (an iOS canvas failure), the empty-result
      // check below turns that into a clean "failed".
      if (blank || !dataUrl.startsWith("data:image/jpeg")) {
        skipped++;
        continue;
      }

      const b64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
      total += b64.length;
      if (total > MAX_TOTAL_BASE64) return { status: "too-large" };
      pages.push(b64);
    }
    return pages.length ? { status: "ok", pages, skipped } : { status: "failed" };
  } catch {
    return { status: "failed" };
  } finally {
    void loadingTask.destroy().catch(() => {});
  }
}

// A real statement page varies across its rows; a failed (blank) render is a
// single flat colour. Sample a few rows sparsely rather than pulling the whole
// bitmap, which would be heavy on a phone.
function isBlankCanvas(ctx: CanvasRenderingContext2D, w: number, h: number): boolean {
  if (w === 0 || h === 0) return true;
  try {
    const rows = [Math.floor(h * 0.25), Math.floor(h * 0.5), Math.floor(h * 0.75)];
    const stride = 4 * Math.max(1, Math.floor(w / 64));
    let first: number | null = null;
    for (const y of rows) {
      const data = ctx.getImageData(0, y, w, 1).data;
      for (let i = 0; i + 2 < data.length; i += stride) {
        const v = ((data[i] ?? 0) << 16) | ((data[i + 1] ?? 0) << 8) | (data[i + 2] ?? 0);
        if (first === null) first = v;
        else if (v !== first) return false;
      }
    }
    return true; // every sampled pixel identical → the render produced nothing
  } catch {
    return false; // couldn't sample — don't wrongly discard a real render
  }
}
