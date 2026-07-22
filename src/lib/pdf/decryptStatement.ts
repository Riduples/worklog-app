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
// The parse-statement route also rejects any SINGLE page over its own
// MAX_IMAGE_BASE64 (1,500,000). Match that here — with a little headroom — so a
// dense page that fits the total but not the per-page cap is shrunk to fit rather
// than uploaded and then 400-rejected after a successful (and slow) decrypt.
const MAX_PAGE_BASE64 = 1_450_000;

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
      // Encode, then step the JPEG quality down until the page fits the server's
      // per-page cap — a dense page can otherwise render larger than the cap and be
      // rejected after upload. Must happen before the canvas is released below.
      let b64 = "";
      if (!blank) {
        for (const q of [JPEG_QUALITY, 0.55, 0.4, 0.3]) {
          const url = canvas.toDataURL("image/jpeg", q);
          if (!url.startsWith("data:image/jpeg")) break; // encode failed → treat as blank
          b64 = url.slice(url.indexOf(",") + 1);
          if (b64.length <= MAX_PAGE_BASE64) break;
        }
      }
      page.cleanup();
      canvas.width = 0; // release the backing store before the next page
      canvas.height = 0;

      // Skip a blank/failed render rather than aborting: it's usually a genuinely
      // empty page. If it happens to EVERY page (an iOS canvas failure), the
      // empty-result check below turns that into a clean "failed".
      if (blank || !b64) {
        skipped++;
        continue;
      }
      // Couldn't shrink a dense page under the per-page cap even at low quality.
      if (b64.length > MAX_PAGE_BASE64) return { status: "too-large" };

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

// A failed (blank) render is a single flat colour end to end; a real statement
// page, however sparse, has a band of content somewhere. Sample a dense grid over
// the WHOLE page and call it blank only when virtually every sample matches the
// background — biased hard toward "not blank", because a false blank drops a real
// page and loses its transactions, while a false non-blank merely sends a white
// page the model reads as empty. (The old check sampled three fixed scanlines at
// 25/50/75% height and missed any page whose only rows sat outside them — e.g. a
// closing balance in the top fifth — dropping it silently.)
function isBlankCanvas(ctx: CanvasRenderingContext2D, w: number, h: number): boolean {
  if (w === 0 || h === 0) return true;
  try {
    const ROWS = 48;
    const COLS = 64;
    const px = (row: Uint8ClampedArray, x: number) => {
      const i = 4 * x;
      return ((row[i] ?? 0) << 16) | ((row[i + 1] ?? 0) << 8) | (row[i + 2] ?? 0);
    };
    // The top-left corner is the background reference. If it happens to sit inside
    // a coloured header band, the white body rows below simply read as content —
    // which is the right answer (the page isn't blank).
    const corner = ctx.getImageData(0, 0, 1, 1).data;
    const bg = ((corner[0] ?? 0) << 16) | ((corner[1] ?? 0) << 8) | (corner[2] ?? 0);
    let sampled = 0;
    let differing = 0;
    for (let r = 0; r < ROWS; r++) {
      const y = Math.min(h - 1, Math.floor((r + 0.5) * (h / ROWS)));
      const row = ctx.getImageData(0, y, w, 1).data;
      for (let c = 0; c < COLS; c++) {
        const x = Math.min(w - 1, Math.floor((c + 0.5) * (w / COLS)));
        sampled++;
        if (px(row, x) !== bg) differing++;
      }
    }
    // Tolerate a trace of stray pixels; any real content band trips well past this.
    return differing <= Math.max(2, Math.floor(sampled * 0.001));
  } catch {
    return false; // couldn't sample — don't wrongly discard a real render
  }
}
