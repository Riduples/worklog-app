import { NextResponse } from "next/server";
import chromium from "@sparticuz/chromium";
import puppeteer, { type Browser } from "puppeteer-core";
import { createClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/rateLimit";
import { buildDocumentHTML, type DocForRender, type DocKind } from "@/lib/docgen/buildDocumentHTML";
import {
  buildStatementHTML,
  buildRemittanceHTML,
  buildAgeAnalysisHTML,
  buildActualVsEstimateHTML,
  buildTravelReportHTML,
  buildStaffRegisterHTML,
  buildAdvancesReportHTML,
  buildLeaveReportHTML,
  buildDiaryReportHTML,
  buildSalesSummaryHTML,
  buildQuoteConversionHTML,
  buildWhatSellsHTML,
  buildRecurringRevenueHTML,
  buildStockOnHandHTML,
  buildMarginsHTML,
  buildReorderHTML,
  buildCostingDriftHTML,
  buildSupplierSpendHTML,
  buildCategorySpendHTML,
  buildCommittedHTML,
  buildBillsDueHTML,
  buildDirectoryHTML,
  buildPayersHTML,
  buildDormantHTML,
  buildMissingDetailsHTML,
  buildEmp201HTML,
  buildVat201HTML,
  buildUif201HTML,
  buildCoidaHTML,
  buildEmp501HTML,
  buildCashFlowHTML,
  type StatementLine,
  type RemittanceLine,
  type StatementCredits,
  type RemittanceCredits,
  type AgeAnalysisRow,
  type AgeAnalysisBucket,
  type JobHoursRow,
  type OtherJobHoursRow,
  type TravelReportRow,
  type TravelLogbook,
  type StaffRegisterReportRow,
  type AdvancesReportRow,
  type AdvancesReportEntry,
  type LeaveReportRowOut,
  type LeaveReportEntry,
  type DiaryReportStatusRow,
  type DiaryReportClientRow,
  type SalesSummaryPdfRow,
  type QuoteConversionPdfRow,
  type SoldItemPdfRow,
  type RecurringPdfRow,
  type StockValuePdfRow,
  type MarginPdfRow,
  type ReorderPdfRow,
  type CostingDriftPdfRow,
  type SupplierSpendPdfRow,
  type CategorySpendPdfRow,
  type CommittedPdfRow,
  type BillDuePdfRow,
  type DirectoryPdfRow,
  type PayerPdfRow,
  type DormantPdfRow,
  type MissingPdfRow,
  type Emp201PdfData,
  type Vat201PdfData,
  type Uif201PdfData,
  type CoidaPdfData,
  type Emp501PdfData,
  type CashFlowPdfData,
} from "@/lib/docgen/buildLedgerHTML";
import type { BusinessProfile } from "@/lib/supabase/hooks/useBusinessProfile";

export const runtime = "nodejs";
// Chromium cold starts are slow; the default 15s isn't enough for a first hit.
export const maxDuration = 60;

// The client sends structured data, never HTML. Rendering attacker-supplied
// markup in a headless browser is an SSRF vector, so the server rebuilds the
// document from our own templates instead of trusting anything renderable.
type RenderRequest =
  | { kind: DocKind; doc: DocForRender }
  | { kind: "statement"; clientName: string; lines: StatementLine[]; totals: { invoiced: number; received: number; outstanding: number }; asAt: string; credits?: StatementCredits }
  | {
      kind: "remittance";
      supplierName: string;
      lines: RemittanceLine[];
      payment: { method: string; date: string; reference: string; total: number };
      credits?: RemittanceCredits;
    }
  | {
      kind: "ageanalysis";
      side: "debtors" | "creditors";
      buckets: AgeAnalysisBucket[];
      items: AgeAnalysisRow[];
      totals: { grandTotal: number; onAccount: number; netOwed: number };
      asAt: string;
    }
  | {
      kind: "actualvsestimate";
      rows: JobHoursRow[];
      other: OtherJobHoursRow[];
      totals: { quoted: number; logged: number; over: number };
      asAt: string;
    }
  | {
      kind: "travelreport";
      rows: TravelReportRow[];
      totals: { trips: number; km: number; deduction: number };
      asAt: string;
      periodLabel?: string;
      logbook?: TravelLogbook | null;
    }
  | {
      kind: "staffregisterreport";
      rows: StaffRegisterReportRow[];
      totals: { people: number; employees: number; contractors: number; active: number; left: number; monthlyWageBill: number };
      asAt: string;
    }
  | {
      kind: "advancesreport";
      rows: AdvancesReportRow[];
      entries: AdvancesReportEntry[];
      totals: { advanced: number; repaid: number; outstanding: number; people: number };
      asAt: string;
    }
  | {
      kind: "leavereport";
      rows: LeaveReportRowOut[];
      entries: LeaveReportEntry[];
      totals: { annual: number; sick: number; family: number; other: number; days: number };
      asAt: string;
    }
  | {
      kind: "diaryreport";
      statuses: DiaryReportStatusRow[];
      clients: DiaryReportClientRow[];
      totals: {
        appointments: number;
        booked: number;
        completed: number;
        lost: number;
        deposits: number;
        outstanding: number;
        hours: number;
        onsite: number;
        inHouse: number;
        noShowRate: number;
        cancelRate: number;
      };
      asAt: string;
      periodLabel?: string;
    }
  | {
      kind: "salessummary";
      rows: SalesSummaryPdfRow[];
      totals: { invoices: number; invoiced: number; vat: number; credited: number; net: number; received: number; outstanding: number; collectedPct: number };
      asAt: string;
      periodLabel?: string;
    }
  | {
      kind: "quoteconversion";
      rows: QuoteConversionPdfRow[];
      totals: { quotes: number; value: number; won: number; wonValue: number; lost: number; lostValue: number; open: number; openValue: number; conversionRate: number };
      asAt: string;
      periodLabel?: string;
    }
  | {
      kind: "whatsells";
      rows: SoldItemPdfRow[];
      totals: { lines: number; value: number };
      asAt: string;
      periodLabel?: string;
    }
  | {
      kind: "recurringrevenue";
      rows: RecurringPdfRow[];
      totals: { count: number; perMonth: number; dueSoon: number };
      asAt: string;
    }
  | {
      kind: "stockonhand";
      rows: StockValuePdfRow[];
      totals: { items: number; units: number; atCost: number; atSell: number; potential: number };
      asAt: string;
    }
  | {
      kind: "margins";
      rows: MarginPdfRow[];
      totals: { items: number; priced: number; atRisk: number; unpriced: number; averageMargin: number };
      asAt: string;
    }
  | {
      kind: "reorderlist";
      rows: ReorderPdfRow[];
      totals: { items: number; outOfStock: number; costToRestock: number };
      asAt: string;
    }
  | {
      kind: "costingdrift";
      rows: CostingDriftPdfRow[];
      totals: { costings: number; linked: number; under: number; shortfall: number };
      asAt: string;
    }
  | {
      kind: "supplierspend";
      rows: SupplierSpendPdfRow[];
      totals: { suppliers: number; billed: number; paid: number; outstanding: number };
      asAt: string;
      periodLabel?: string;
    }
  | {
      kind: "categoryspend";
      rows: CategorySpendPdfRow[];
      totals: { total: number; count: number; categories: number; uncategorised: number };
      asAt: string;
      periodLabel?: string;
    }
  | {
      kind: "committedonorder";
      rows: CommittedPdfRow[];
      totals: { orders: number; amount: number; overdue: number; overdueAmount: number };
      asAt: string;
    }
  | {
      kind: "billsdue";
      rows: BillDuePdfRow[];
      totals: { overdue: number; week: number; month: number; later: number; undated: number; total: number; count: number };
      asAt: string;
    }
  | {
      kind: "contactdirectory";
      rows: DirectoryPdfRow[];
      totals: { customers: number; suppliers: number };
      asAt: string;
    }
  | {
      kind: "payers";
      rows: PayerPdfRow[];
      totals: { customers: number; measured: number; disagree: number; overdueAmount: number };
      asAt: string;
    }
  | {
      kind: "dormantcustomers";
      rows: DormantPdfRow[];
      totals: { dormant: number; never: number; customers: number };
      asAt: string;
      monthsLabel?: string;
    }
  | {
      kind: "missingdetails";
      rows: MissingPdfRow[];
      totals: { contacts: number; incomplete: number; blocking: number };
      asAt: string;
    }
  | {
      kind: "emp201";
      data: Emp201PdfData;
      asAt: string;
    }
  | {
      kind: "vat201";
      data: Vat201PdfData;
      asAt: string;
    }
  | {
      kind: "uif201";
      data: Uif201PdfData;
      asAt: string;
    }
  | {
      kind: "coida";
      data: CoidaPdfData;
      asAt: string;
    }
  | {
      kind: "emp501";
      data: Emp501PdfData;
      asAt: string;
    }
  | {
      kind: "cashflow";
      data: CashFlowPdfData;
      asAt: string;
    };

function buildHtml(body: RenderRequest, business: BusinessProfile, watermark: boolean): string | null {
  switch (body.kind) {
    case "quote":
    case "invoice":
    case "purchaseorder":
    case "payslip":
    case "creditnote":
      return buildDocumentHTML(body.doc, business, body.kind, watermark);
    case "statement":
      return buildStatementHTML(business, body.clientName, body.lines, body.totals, body.asAt, watermark, body.credits);
    case "remittance":
      return buildRemittanceHTML(business, body.supplierName, body.lines, body.payment, watermark, body.credits);
    case "ageanalysis":
      return buildAgeAnalysisHTML(business, body.side, body.buckets, body.items, body.totals, body.asAt, watermark);
    case "actualvsestimate":
      return buildActualVsEstimateHTML(business, body.rows, body.other, body.totals, body.asAt, watermark);
    case "travelreport":
      return buildTravelReportHTML(business, body.rows, body.totals, body.asAt, watermark, body.periodLabel, body.logbook);
    case "staffregisterreport":
      return buildStaffRegisterHTML(business, body.rows, body.totals, body.asAt, watermark);
    case "advancesreport":
      return buildAdvancesReportHTML(business, body.rows, body.entries, body.totals, body.asAt, watermark);
    case "leavereport":
      return buildLeaveReportHTML(business, body.rows, body.entries, body.totals, body.asAt, watermark);
    case "diaryreport":
      return buildDiaryReportHTML(business, body.statuses, body.clients, body.totals, body.asAt, watermark, body.periodLabel);
    case "salessummary":
      return buildSalesSummaryHTML(business, body.rows, body.totals, body.asAt, watermark, body.periodLabel);
    case "quoteconversion":
      return buildQuoteConversionHTML(business, body.rows, body.totals, body.asAt, watermark, body.periodLabel);
    case "whatsells":
      return buildWhatSellsHTML(business, body.rows, body.totals, body.asAt, watermark, body.periodLabel);
    case "recurringrevenue":
      return buildRecurringRevenueHTML(business, body.rows, body.totals, body.asAt, watermark);
    case "stockonhand":
      return buildStockOnHandHTML(business, body.rows, body.totals, body.asAt, watermark);
    case "margins":
      return buildMarginsHTML(business, body.rows, body.totals, body.asAt, watermark);
    case "reorderlist":
      return buildReorderHTML(business, body.rows, body.totals, body.asAt, watermark);
    case "costingdrift":
      return buildCostingDriftHTML(business, body.rows, body.totals, body.asAt, watermark);
    case "supplierspend":
      return buildSupplierSpendHTML(business, body.rows, body.totals, body.asAt, watermark, body.periodLabel);
    case "categoryspend":
      return buildCategorySpendHTML(business, body.rows, body.totals, body.asAt, watermark, body.periodLabel);
    case "committedonorder":
      return buildCommittedHTML(business, body.rows, body.totals, body.asAt, watermark);
    case "billsdue":
      return buildBillsDueHTML(business, body.rows, body.totals, body.asAt, watermark);
    case "contactdirectory":
      return buildDirectoryHTML(business, body.rows, body.totals, body.asAt, watermark);
    case "payers":
      return buildPayersHTML(business, body.rows, body.totals, body.asAt, watermark);
    case "dormantcustomers":
      return buildDormantHTML(business, body.rows, body.totals, body.asAt, watermark, body.monthsLabel);
    case "missingdetails":
      return buildMissingDetailsHTML(business, body.rows, body.totals, body.asAt, watermark);
    case "emp201":
      return buildEmp201HTML(business, body.data, body.asAt, watermark);
    case "vat201":
      return buildVat201HTML(business, body.data, body.asAt, watermark);
    case "uif201":
      return buildUif201HTML(business, body.data, body.asAt, watermark);
    case "coida":
      return buildCoidaHTML(business, body.data, body.asAt, watermark);
    case "cashflow":
      return buildCashFlowHTML(business, body.data, body.asAt, watermark);
    case "emp501":
      return buildEmp501HTML(business, body.data, body.asAt, watermark);
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

  // No model call here, but every request boots a Chromium — the cost is the
  // function's memory and time rather than tokens.
  const limited = await enforceRateLimit(supabase, "render-pdf");
  if (limited) return limited;

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

  // Trial / never-paid businesses get a "TRIAL — NOT FINAL" watermark: they can
  // still generate and see every document, but it isn't a usable final artifact
  // until they've paid once. `status` only becomes 'active' after a PayFast payment
  // the server verified, so this can't be spoofed from the client.
  const { data: sub } = await supabase.from("subscriptions").select("status").eq("business_id", business.id).maybeSingle();
  const watermark = sub?.status === "trialing" || sub?.status === "read_only";

  let html: string | null;
  try {
    html = buildHtml(body, letterhead, watermark);
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
