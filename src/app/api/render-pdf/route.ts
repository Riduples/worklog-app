import { NextResponse } from "next/server";
import chromium from "@sparticuz/chromium";
import puppeteer, { type Browser } from "puppeteer-core";
import { createClient } from "@/lib/supabase/server";
import { buildDocumentHTML, type DocForRender, type DocKind } from "@/lib/docgen/buildDocumentHTML";
import { buildStatementHTML, buildRemittanceHTML, type StatementLine, type RemittanceLine } from "@/lib/docgen/buildLedgerHTML";
import type { BusinessProfile } from "@/lib/supabase/hooks/useBusinessProfile";

export const runtime = "nodejs";
// Chromium cold starts are slow; the default 15s isn't enough for a first hit.
export const maxDuration = 60;

// The client sends structured data, never HTML. Rendering attacker-supplied
// markup in a headless browser is an SSRF vector, so the server rebuilds the
// document from our own templates instead of trusting anything renderable.
type RenderRequest =
  | { kind: DocKind; doc: DocForRender }
  | { kind: "statement"; clientName: string; lines: StatementLine[]; totals: { invoiced: number; received: number; outstanding: number }; asAt: string }
  | {
      kind: "remittance";
      supplierName: string;
      lines: RemittanceLine[];
      payment: { method: string; date: string; reference: string; total: number };
    };

function buildHtml(body: RenderRequest, business: BusinessProfile): string | null {
  switch (body.kind) {
    case "quote":
    case "invoice":
    case "purchaseorder":
    case "payslip":
      return buildDocumentHTML(body.doc, business, body.kind);
    case "statement":
      return buildStatementHTML(business, body.clientName, body.lines, body.totals, body.asAt);
    case "remittance":
      return buildRemittanceHTML(business, body.supplierName, body.lines, body.payment);
    default:
      return null;
  }
}

// Only ever our own logo bucket. logo_url is a column the user can write, so
// fetching whatever it says would hand them a request-forgery primitive: point
// it at a cloud metadata endpoint or an internal address and this server would
// dutifully fetch it. Pinning to the exact public prefix of one bucket means a
// tampered value fetches nothing instead.
const LOGO_PREFIX = `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""}/storage/v1/object/public/business-logos/`;
const MAX_LOGO_BYTES = 2 * 1024 * 1024; // matches the bucket's own limit

async function inlineLogo(logoUrl: string | null): Promise<string | null> {
  if (!logoUrl || !LOGO_PREFIX.startsWith("http") || !logoUrl.startsWith(LOGO_PREFIX)) return null;
  try {
    const res = await fetch(logoUrl, { signal: AbortSignal.timeout(5_000), redirect: "error" });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    if (!type.startsWith("image/")) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > MAX_LOGO_BYTES) return null;
    return `data:${type};base64,${buf.toString("base64")}`;
  } catch {
    // A missing or slow logo must never cost someone their invoice.
    return null;
  }
}

async function launchBrowser(): Promise<Browser> {
  // @sparticuz/chromium only ships a Linux binary for the serverless runtime.
  // Locally, point at an installed Chrome via PUPPETEER_EXECUTABLE_PATH.
  const localExecutable = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (localExecutable) {
    return puppeteer.launch({ executablePath: localExecutable, headless: true, args: ["--no-sandbox"] });
  }
  return puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: true,
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized", message: "Not signed in." }, { status: 401 });
  }

  let body: RenderRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request", message: "Invalid request body." }, { status: 400 });
  }

  // Letterhead comes from the DB, not the request — a caller shouldn't be able
  // to render a document under someone else's business identity. RLS scopes
  // this to the caller's own business.
  const { data: business } = await supabase.from("business_profiles").select("*").single();
  if (!business) {
    return NextResponse.json({ error: "no_business", message: "No business profile found." }, { status: 400 });
  }

  // The rendering page has its network blocked (see the interception below), so
  // an <img src="https://..."> would simply be dropped and the letterhead would
  // come out blank. Fetch the logo here, where the network is ours, and hand
  // the template a data: URI instead.
  const letterhead = { ...(business as BusinessProfile), logo_url: await inlineLogo(business.logo_url) };

  let html: string | null;
  try {
    html = buildHtml(body, letterhead);
  } catch {
    return NextResponse.json({ error: "bad_request", message: "Couldn't build that document." }, { status: 400 });
  }
  if (!html) {
    return NextResponse.json({ error: "bad_request", message: "Unknown document type." }, { status: 400 });
  }

  let browser: Browser | null = null;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();

    // Defence in depth. Our templates are fully self-contained (inline CSS, no
    // images, no fonts, no scripts), so nothing legitimate needs the network or
    // JS. Blocking both means even a hostile string interpolated into the
    // markup can't phone home or execute.
    await page.setJavaScriptEnabled(false);
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      // Allow only the main-frame bootstrap (about:blank / data:) that
      // setContent itself needs. Every subresource — and any redirect an
      // injected <meta refresh> might attempt — is aborted.
      const isMainNav = req.isNavigationRequest() && req.frame() === page.mainFrame();
      const url = req.url();
      const safeScheme = url.startsWith("about:") || url.startsWith("data:");
      if (isMainNav && safeScheme) req.continue();
      else req.abort();
    });

    await page.setContent(html, { waitUntil: "load", timeout: 20_000 });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "12mm", bottom: "12mm", left: "10mm", right: "10mm" },
    });

    return new NextResponse(Buffer.from(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const message = err instanceof Error && /executablePath|ENOENT|Failed to launch/i.test(err.message)
      ? "PDF rendering isn't available in this environment."
      : "Couldn't render the PDF.";
    return NextResponse.json({ error: "render_failed", message }, { status: 502 });
  } finally {
    await browser?.close().catch(() => {});
  }
}
