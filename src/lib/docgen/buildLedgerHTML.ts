// Customer statements and supplier remittance advices are ledgers of whole
// documents, not line-item documents — the debit/credit/status columns don't
// map onto buildDocumentHTML's subtotal/VAT/deposit shape, so they get their
// own builder (matching the source prototype, which did the same).
import { fmt } from "@/lib/format";
import { esc } from "@/lib/docgen/esc";
import type { BusinessProfile } from "@/lib/supabase/hooks/useBusinessProfile";

const SHARED_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; background: #fff; color: #111; padding: 40px; width: 700px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #0C4A6E; padding-bottom: 20px; margin-bottom: 28px; }
  .brand { display: flex; align-items: center; gap: 10px; }
  .brand-mark { background: #F59E0B; border-radius: 8px; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 18px; color: #0C4A6E; font-family: monospace; }
  .brand-name { font-size: 13px; font-weight: 900; color: #0C4A6E; letter-spacing: 1.5px; }
  .doc-title { font-size: 26px; font-weight: 800; color: #0C4A6E; text-align: right; }
  .doc-date { font-size: 12px; color: #64748b; text-align: right; margin-top: 4px; }
  .meta-row { display: flex; justify-content: space-between; margin-bottom: 28px; gap: 24px; }
  .meta-label { font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 6px; }
  .meta-value { font-size: 13px; color: #111; line-height: 1.5; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  thead th { background: #F0F9FF; padding: 10px 8px; font-size: 11px; font-weight: 700; color: #0C4A6E; text-transform: uppercase; letter-spacing: 0.5px; text-align: left; }
  td { padding: 9px 8px; border-bottom: 1px solid #f0f0f0; font-size: 13px; }
  .totals { display: flex; justify-content: flex-end; }
  .totals-box { width: 300px; }
  .totals-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 13px; color: #374151; }
  .totals-row.final { border-top: 2px solid #0C4A6E; margin-top: 6px; padding-top: 12px; font-size: 18px; font-weight: 800; color: #0C4A6E; }
  .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #94a3b8; line-height: 1.6; }
  .vat-note { font-size: 10px; color: #94a3b8; margin-top: 4px; }
  /* Trial watermark — position:fixed so Chromium repeats it on every printed page. */
  .wm { position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%) rotate(-32deg); font-size: 82px; font-weight: 900; color: rgba(220,38,38,0.10); letter-spacing: 6px; white-space: nowrap; z-index: 9999; pointer-events: none; }
`;

// The letterhead is the BUSINESS's, not ours. A statement goes from them to
// their customer and a remittance from them to their supplier, so heading either
// with Worklog's mark put our name on their correspondence. buildDocumentHTML
// was fixed for this; this builder was missed, so it kept printing "W" /
// "Worklog" / "worklog.co.za" while ignoring the `business` it was handed. Our
// credit stays in the footer, where attribution belongs.
//
// logo_url must already be renderable by the time it arrives here: the PDF route
// inlines it as a data: URI first, because that page has its network blocked.
// See /api/render-pdf, which passes the same inlined profile to every builder.
function header(business: BusinessProfile, title: string, dateLabel: string) {
  const initial = (business.name || "W").trim().charAt(0).toUpperCase();
  const logoHTML = business.logo_url
    ? `<img src="${esc(business.logo_url)}" alt="" style="width:44px;height:44px;object-fit:contain;border-radius:8px;" />`
    : `<div class="brand-mark">${esc(initial)}</div>`;

  return `
  <div class="header">
    <div class="brand">
      ${logoHTML}
      <div>
        <div class="brand-name">${esc(business.name || "Your Business")}</div>
        <div style="font-size:10px;color:#94a3b8;">${esc(business.phone || business.email || "")}</div>
      </div>
    </div>
    <div>
      <div class="doc-title">${esc(title)}</div>
      <div class="doc-date">${esc(dateLabel)}</div>
    </div>
  </div>`;
}

function fromBlock(business: BusinessProfile, label: string) {
  return `
    <div>
      <div class="meta-label">${esc(label)}</div>
      <div class="meta-value">
        <strong>${esc(business.name || "Your Business")}</strong><br/>
        ${business.address ? esc(business.address) + "<br/>" : ""}
        ${business.phone ? esc(business.phone) + "<br/>" : ""}
        ${esc(business.email ?? "")}
      </div>
      ${business.vat_number ? `<div class="vat-note">VAT Reg No: ${esc(business.vat_number)}</div>` : ""}
    </div>`;
}

export type StatementLine = {
  date: string;
  reference: string;
  amount: number;
  balance: number;
  paid: boolean;
};

// Shared shape for a credit-note row shown on a statement or remittance.
export type LedgerCreditLine = { date: string; reference: string; amount: number; status: string };
export type StatementCredits = { lines: LedgerCreditLine[]; onAccount: number; netOutstanding: number };

export function buildStatementHTML(
  business: BusinessProfile,
  clientName: string,
  lines: StatementLine[],
  totals: { invoiced: number; received: number; outstanding: number },
  asAt: string,
  watermark = false,
  credits?: StatementCredits
): string {
  const rows = lines
    .map(
      (l) => `
      <tr>
        <td>${esc(l.date)}</td>
        <td>${esc(l.reference)}</td>
        <td>Invoice issued</td>
        <td style="text-align:right;">${fmt(l.amount)}</td>
        <td style="text-align:right;color:${l.paid ? "#0369A1" : "#b45309"};">${l.paid ? "✓ Paid" : fmt(l.balance) + " due"}</td>
      </tr>`
    )
    .join("");

  const creditRows = credits
    ? credits.lines
        .map(
          (c) => `
      <tr>
        <td>${esc(c.date)}</td>
        <td>${esc(c.reference)}</td>
        <td style="text-align:right;">−${fmt(c.amount)}</td>
        <td style="text-align:right;">${esc(c.status)}</td>
      </tr>`
        )
        .join("")
    : "";

  const creditsSection =
    credits && credits.lines.length
      ? `<div style="font-size:11px;font-weight:700;color:#0C4A6E;text-transform:uppercase;letter-spacing:0.6px;margin:8px 0 10px;">Credit notes</div>
  <table>
    <thead>
      <tr><th>Date</th><th>Reference</th><th style="text-align:right;">Amount</th><th style="text-align:right;">Status</th></tr>
    </thead>
    <tbody>${creditRows}</tbody>
  </table>
  `
      : "";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><title>Statement — ${esc(clientName)}</title><style>${SHARED_CSS}</style></head>
<body>
  ${watermark ? `<div class="wm">TRIAL — NOT FINAL</div>` : ""}
  ${header(business, "ACCOUNT STATEMENT", `As at ${asAt}`)}
  <div class="meta-row">
    ${fromBlock(business, "From")}
    <div style="text-align:right;">
      <div class="meta-label">Statement For</div>
      <div style="font-size:20px;font-weight:800;">${esc(clientName)}</div>
    </div>
  </div>
  <table>
    <thead>
      <tr><th>Date</th><th>Reference</th><th>Description</th><th style="text-align:right;">Amount</th><th style="text-align:right;">Status</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  ${creditsSection}<div class="totals">
    <div class="totals-box">
      <div class="totals-row"><span>Total invoiced</span><span>${fmt(totals.invoiced)}</span></div>
      <div class="totals-row"><span>Total received</span><span>${fmt(totals.received)}</span></div>
      ${credits && credits.onAccount > 0 ? `<div class="totals-row" style="color:#0C4A6E;"><span>Credit on account (owed back)</span><span>−${fmt(credits.onAccount)}</span></div>\n      ` : ""}<div class="totals-row final"><span>${credits ? "Net outstanding" : "Balance outstanding"}</span><span>${credits ? fmt(credits.netOutstanding) : fmt(totals.outstanding)}</span></div>
    </div>
  </div>
  <div class="footer">
    Please contact us if you have any queries regarding this statement.<br/>Generated via Worklog — worklog.co.za${
      watermark ? `<br/><strong style="color:#dc2626;">Draft — made on a free Worklog trial.</strong>` : ""
    }
  </div>
</body>
</html>`;
}

export type RemittanceLine = {
  date: string;
  reference: string;
  invoiceAmount: number;
  amountPaying: number;
};

export type RemittanceCredits = { lines: LedgerCreditLine[]; onAccount: number; netPayable: number };

export function buildRemittanceHTML(
  business: BusinessProfile,
  supplierName: string,
  lines: RemittanceLine[],
  payment: { method: string; date: string; reference: string; total: number },
  watermark = false,
  credits?: RemittanceCredits
): string {
  const rows = lines
    .map(
      (l) => `
      <tr>
        <td>${esc(l.date)}</td>
        <td>${esc(l.reference)}</td>
        <td style="text-align:right;">${fmt(l.invoiceAmount)}</td>
        <td style="text-align:right;font-weight:700;color:#0C4A6E;">${fmt(l.amountPaying)}</td>
      </tr>`
    )
    .join("");

  const creditRows = credits
    ? credits.lines
        .map(
          (c) => `
      <tr>
        <td>${esc(c.date)}</td>
        <td>${esc(c.reference)}</td>
        <td style="text-align:right;">−${fmt(c.amount)}</td>
        <td style="text-align:right;">${esc(c.status)}</td>
      </tr>`
        )
        .join("")
    : "";

  const creditsSection =
    credits && credits.lines.length
      ? `<div style="font-size:11px;font-weight:700;color:#b45309;text-transform:uppercase;letter-spacing:0.6px;margin:8px 0 10px;">Supplier credit notes</div>
  <table>
    <thead>
      <tr><th>Date</th><th>Reference</th><th style="text-align:right;">Amount</th><th style="text-align:right;">Status</th></tr>
    </thead>
    <tbody>${creditRows}</tbody>
  </table>
  `
      : "";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><title>Remittance Advice — ${esc(supplierName)}</title><style>${SHARED_CSS}</style></head>
<body>
  ${watermark ? `<div class="wm">TRIAL — NOT FINAL</div>` : ""}
  ${header(business, "REMITTANCE ADVICE", payment.date)}
  <div class="meta-row">
    ${fromBlock(business, "Payment From")}
    <div style="text-align:right;">
      <div class="meta-label">Payment To</div>
      <div style="font-size:20px;font-weight:800;">${esc(supplierName)}</div>
    </div>
  </div>
  <div style="background:#fff7ed;border-radius:12px;padding:16px 20px;margin-bottom:24px;display:flex;justify-content:space-between;align-items:center;">
    <div>
      <div style="font-size:11px;color:#b45309;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:4px;">Payment method</div>
      <div style="font-size:15px;font-weight:700;">${esc(payment.method)}</div>
      ${payment.reference ? `<div style="font-size:12px;color:#64748b;margin-top:2px;">Ref: ${esc(payment.reference)}</div>` : ""}
    </div>
    <div style="text-align:right;">
      <div style="font-size:11px;color:#b45309;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:4px;">Payment date</div>
      <div style="font-size:15px;font-weight:700;">${esc(payment.date)}</div>
    </div>
  </div>
  <div style="font-size:11px;font-weight:700;color:#b45309;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:10px;">Invoices being settled</div>
  <table>
    <thead>
      <tr><th>Invoice date</th><th>Your ref</th><th style="text-align:right;">Invoice amount</th><th style="text-align:right;">Amount paying</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  ${creditsSection}<div class="totals">
    <div class="totals-box">
      ${credits ? `<div class="totals-row"><span>Total payment</span><span>${fmt(payment.total)}</span></div>\n      ${credits.onAccount > 0 ? `<div class="totals-row" style="color:#0C4A6E;"><span>Credit on account (owed to you)</span><span>−${fmt(credits.onAccount)}</span></div>\n      ` : ""}<div class="totals-row final"><span>Net payable</span><span>${fmt(credits.netPayable)}</span></div>` : `<div class="totals-row final"><span>Total payment</span><span>${fmt(payment.total)}</span></div>`}
    </div>
  </div>
  <div class="footer">
    Please apply this payment to the invoices listed above. Contact us if you have any queries.<br/>Generated via Worklog — worklog.co.za${
      watermark ? `<br/><strong style="color:#dc2626;">Draft — made on a free Worklog trial.</strong>` : ""
    }
  </div>
</body>
</html>`;
}

// An age analysis is an internal working report — who owes you (debtors) or who
// you owe (creditors), grouped by how overdue each amount is. It's the business's
// own report, so it heads with their letterhead like the statement/remittance.
export type AgeAnalysisRow = { name: string; reference: string; date: string; days: number; amount: number };
export type AgeAnalysisBucket = { label: string; total: number };

export function buildAgeAnalysisHTML(
  business: BusinessProfile,
  side: "debtors" | "creditors",
  buckets: AgeAnalysisBucket[],
  items: AgeAnalysisRow[],
  totals: { grandTotal: number; onAccount: number; netOwed: number },
  asAt: string,
  watermark = false
): string {
  const isDebtors = side === "debtors";
  const subject = isDebtors ? "Customers" : "Suppliers";
  const partyHeading = isDebtors ? "Customer" : "Supplier";

  const bucketHead = buckets.map((b) => `<th style="text-align:center;">${esc(b.label)} days</th>`).join("");
  const bucketCells = buckets.map((b) => `<td style="text-align:center;font-weight:700;">${fmt(b.total)}</td>`).join("");

  const rows = items.length
    ? items
        .map(
          (i) => `
      <tr>
        <td>${esc(i.name)}</td>
        <td>${esc(i.reference || "—")}</td>
        <td>${esc(i.date || "—")}</td>
        <td style="text-align:right;">${i.days}</td>
        <td style="text-align:right;font-weight:700;">${fmt(i.amount)}</td>
      </tr>`
        )
        .join("")
    : `<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:16px;">Nothing outstanding.</td></tr>`;

  const netLabel = totals.onAccount > 0
    ? isDebtors
      ? "Net owed to you"
      : "Net you owe"
    : isDebtors
      ? "Total owed to you"
      : "Total you owe";
  const netValue = totals.onAccount > 0 ? totals.netOwed : totals.grandTotal;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><title>Age Analysis — ${esc(subject)}</title><style>${SHARED_CSS}</style></head>
<body>
  ${watermark ? `<div class="wm">TRIAL — NOT FINAL</div>` : ""}
  ${header(business, `AGE ANALYSIS — ${subject.toUpperCase()}`, `As at ${asAt}`)}
  <div class="meta-row">
    ${fromBlock(business, "Prepared by")}
    <div style="text-align:right;">
      <div class="meta-label">Report</div>
      <div style="font-size:20px;font-weight:800;">${isDebtors ? "Money owed to you" : "Money you owe"}</div>
    </div>
  </div>
  <div style="font-size:11px;font-weight:700;color:#0C4A6E;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:10px;">Outstanding by age</div>
  <table>
    <thead><tr>${bucketHead}</tr></thead>
    <tbody><tr>${bucketCells}</tr></tbody>
  </table>
  <div style="font-size:11px;font-weight:700;color:#0C4A6E;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:10px;">Detail</div>
  <table>
    <thead>
      <tr><th>${partyHeading}</th><th>Reference</th><th>Date</th><th style="text-align:right;">Days overdue</th><th style="text-align:right;">Amount</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="totals">
    <div class="totals-box">
      <div class="totals-row"><span>Total ${isDebtors ? "owed to you" : "you owe"}</span><span>${fmt(totals.grandTotal)}</span></div>
      ${totals.onAccount > 0 ? `<div class="totals-row" style="color:#0C4A6E;"><span>Less credit on account</span><span>−${fmt(totals.onAccount)}</span></div>\n      ` : ""}<div class="totals-row final"><span>${netLabel}</span><span>${fmt(netValue)}</span></div>
    </div>
  </div>
  <div class="footer">
    An internal age analysis of amounts outstanding as at ${esc(asAt)}.<br/>Generated via Worklog — worklog.co.za${
      watermark ? `<br/><strong style="color:#dc2626;">Draft — made on a free Worklog trial.</strong>` : ""
    }
  </div>
</body>
</html>`;
}

// Actual vs Estimate — an internal report comparing the hours logged on each job
// against the hours quoted for it, with the billable / non-billable split so an
// over-run can be judged. Business's own report, so it heads with their letterhead.
export type JobHoursRow = {
  client: string;
  reference: string; // quote doc number
  quotedHours: number;
  loggedHours: number;
  billableHours: number;
  nonBillableHours: number;
  overBy: number; // hours past the quote (0 when within)
  remaining: number; // hours left before the quote (0 when over)
  status: string; // "Over" | "Near limit" | "On track"
};
export type OtherJobHoursRow = { client: string; loggedHours: number; billableHours: number; nonBillableHours: number };

export function buildActualVsEstimateHTML(
  business: BusinessProfile,
  rows: JobHoursRow[],
  other: OtherJobHoursRow[],
  totals: { quoted: number; logged: number; over: number },
  asAt: string,
  watermark = false
): string {
  const h = (n: number) => `${n.toFixed(1)}h`;

  const detailRows = rows.length
    ? rows
        .map(
          (r) => `
      <tr>
        <td>${esc(r.client)}</td>
        <td>${esc(r.reference || "—")}</td>
        <td style="text-align:right;">${h(r.quotedHours)}</td>
        <td style="text-align:right;font-weight:700;">${h(r.loggedHours)}</td>
        <td style="text-align:right;">${h(r.billableHours)}</td>
        <td style="text-align:right;">${h(r.nonBillableHours)}</td>
        <td style="text-align:right;font-weight:700;color:${r.overBy > 0 ? "#be123c" : "#0369A1"};">${r.overBy > 0 ? `+${h(r.overBy)}` : `${h(r.remaining)} left`}</td>
        <td>${esc(r.status)}</td>
      </tr>`
        )
        .join("")
    : `<tr><td colspan="8" style="text-align:center;color:#94a3b8;padding:16px;">No quoted jobs with linked time yet.</td></tr>`;

  const otherSection = other.length
    ? `<div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.6px;margin:8px 0 10px;">Other logged time — no estimate</div>
  <table>
    <thead>
      <tr><th>Customer</th><th style="text-align:right;">Logged</th><th style="text-align:right;">Billable</th><th style="text-align:right;">Non-billable</th></tr>
    </thead>
    <tbody>${other
      .map(
        (o) => `
      <tr>
        <td>${esc(o.client)}</td>
        <td style="text-align:right;font-weight:700;">${h(o.loggedHours)}</td>
        <td style="text-align:right;">${h(o.billableHours)}</td>
        <td style="text-align:right;">${h(o.nonBillableHours)}</td>
      </tr>`
      )
      .join("")}</tbody>
  </table>
  `
    : "";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><title>Actual vs Estimate</title><style>${SHARED_CSS}</style></head>
<body>
  ${watermark ? `<div class="wm">TRIAL — NOT FINAL</div>` : ""}
  ${header(business, "ACTUAL VS ESTIMATE", `As at ${asAt}`)}
  <div class="meta-row">
    ${fromBlock(business, "Prepared by")}
    <div style="text-align:right;">
      <div class="meta-label">Report</div>
      <div style="font-size:20px;font-weight:800;">Hours logged vs quoted</div>
    </div>
  </div>
  <div style="font-size:11px;font-weight:700;color:#0C4A6E;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:10px;">Summary</div>
  <table>
    <thead><tr><th style="text-align:center;">Quoted hours</th><th style="text-align:center;">Logged hours</th><th style="text-align:center;">Over quote</th></tr></thead>
    <tbody><tr>
      <td style="text-align:center;font-weight:700;">${h(totals.quoted)}</td>
      <td style="text-align:center;font-weight:700;">${h(totals.logged)}</td>
      <td style="text-align:center;font-weight:700;color:${totals.over > 0 ? "#be123c" : "#0369A1"};">${h(totals.over)}</td>
    </tr></tbody>
  </table>
  <div style="font-size:11px;font-weight:700;color:#0C4A6E;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:10px;">Per job</div>
  <table>
    <thead>
      <tr><th>Job</th><th>Quote</th><th style="text-align:right;">Quoted</th><th style="text-align:right;">Logged</th><th style="text-align:right;">Billable</th><th style="text-align:right;">Non-bill.</th><th style="text-align:right;">Variance</th><th>Status</th></tr>
    </thead>
    <tbody>${detailRows}</tbody>
  </table>
  ${otherSection}<div class="footer">
    Hours logged against quoted estimates as at ${esc(asAt)}. Billable / non-billable split shown so any over-run can be billed or absorbed.<br/>Generated via Worklog — worklog.co.za${
      watermark ? `<br/><strong style="color:#dc2626;">Draft — made on a free Worklog trial.</strong>` : ""
    }
  </div>
</body>
</html>`;
}

// Travel report — the business's own record of kilometres driven for work and the
// SARS deduction claimed, for tax records. Heads with their letterhead.
export type TravelReportRow = { date: string; type: string; purpose: string; odoStart: number; odoEnd: number; km: number; deduction: number };

// The annual logbook summary for a tax year — the piece SARS needs on top of the
// per-trip list: the vehicle, the year's opening/closing odometer, and the
// business-vs-private split read from them. Null fields print as "—" (not yet
// entered) so a half-filled logbook still renders.
export type TravelLogbook = {
  vehicle: string;
  registration: string;
  taxYearLabel: string;
  openingOdo: number | null;
  closingOdo: number | null;
  totalKm: number | null;
  businessKm: number;
  privateKm: number | null;
  businessPct: number | null;
};

export function buildTravelReportHTML(
  business: BusinessProfile,
  rows: TravelReportRow[],
  totals: { trips: number; km: number; deduction: number },
  asAt: string,
  watermark = false,
  periodLabel?: string,
  logbook?: TravelLogbook | null
): string {
  const detailRows = rows.length
    ? rows
        .map((r) => {
          // On-site / Quick Log trips are auto-logged with no real odometer
          // (start 0, end = distance); print an em-dash rather than a fabricated
          // 0→N reading sitting among the real ones on the SARS logbook.
          const noOdo = r.odoStart === 0 && r.odoEnd === r.km;
          return `
      <tr>
        <td>${esc(r.date)}</td>
        <td>${esc(r.type)}</td>
        <td>${esc(r.purpose || "—")}</td>
        <td style="text-align:right;">${noOdo ? "—" : r.odoStart.toFixed(0)}</td>
        <td style="text-align:right;">${noOdo ? "—" : r.odoEnd.toFixed(0)}</td>
        <td style="text-align:right;">${r.km.toFixed(1)} km</td>
        <td style="text-align:right;font-weight:700;">${fmt(r.deduction)}</td>
      </tr>`;
        })
        .join("")
    : `<tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:16px;">No trips logged.</td></tr>`;

  // Annual logbook summary — only when the report is scoped to a tax year and the
  // vehicle/odometer have been set up. Half-filled readings still print ("—").
  const odo = (n: number | null) => (n == null ? "—" : n.toFixed(0));
  const km1 = (n: number | null) => (n == null ? "—" : `${n.toFixed(1)} km`);
  const logbookBlock = logbook
    ? `<div style="font-size:11px;font-weight:700;color:#0C4A6E;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:10px;">Logbook — ${esc(logbook.taxYearLabel)}</div>
  <table>
    <tbody>
      <tr><td>Vehicle</td><td style="text-align:right;font-weight:700;">${esc(logbook.vehicle || "—")}${logbook.registration ? ` · ${esc(logbook.registration)}` : ""}</td></tr>
      <tr><td>Opening odometer</td><td style="text-align:right;">${odo(logbook.openingOdo)}</td></tr>
      <tr><td>Closing odometer</td><td style="text-align:right;">${odo(logbook.closingOdo)}</td></tr>
      <tr><td>Total distance (year)</td><td style="text-align:right;font-weight:700;">${km1(logbook.totalKm)}</td></tr>
      <tr><td>Business distance</td><td style="text-align:right;">${km1(logbook.businessKm)}</td></tr>
      <tr><td>Private distance</td><td style="text-align:right;">${km1(logbook.privateKm)}</td></tr>
      <tr><td>Business use</td><td style="text-align:right;font-weight:700;">${logbook.businessPct == null ? "—" : `${logbook.businessPct.toFixed(0)}%`}</td></tr>
    </tbody>
  </table>
  `
    : "";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><title>Travel Report</title><style>${SHARED_CSS}</style></head>
<body>
  ${watermark ? `<div class="wm">TRIAL — NOT FINAL</div>` : ""}
  ${header(business, "TRAVEL REPORT", periodLabel ? `${periodLabel} · as at ${asAt}` : `As at ${asAt}`)}
  <div class="meta-row">
    ${fromBlock(business, "Prepared by")}
    <div style="text-align:right;">
      <div class="meta-label">Report</div>
      <div style="font-size:20px;font-weight:800;">Business travel &amp; SARS deduction</div>
      ${periodLabel ? `<div style="font-size:12px;color:#64748b;margin-top:2px;">${esc(periodLabel)}</div>` : ""}
    </div>
  </div>
  <div style="font-size:11px;font-weight:700;color:#0C4A6E;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:10px;">Summary</div>
  <table>
    <thead><tr><th style="text-align:center;">Trips</th><th style="text-align:center;">Total distance</th><th style="text-align:center;">SARS deduction</th></tr></thead>
    <tbody><tr>
      <td style="text-align:center;font-weight:700;">${totals.trips}</td>
      <td style="text-align:center;font-weight:700;">${totals.km.toFixed(1)} km</td>
      <td style="text-align:center;font-weight:700;color:#92400e;">${fmt(totals.deduction)}</td>
    </tr></tbody>
  </table>
  ${logbookBlock}<div style="font-size:11px;font-weight:700;color:#0C4A6E;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:10px;">Trips</div>
  <table>
    <thead>
      <tr><th>Date</th><th>Type</th><th>Purpose</th><th style="text-align:right;">Opening km</th><th style="text-align:right;">Closing km</th><th style="text-align:right;">Distance</th><th style="text-align:right;">Deduction</th></tr>
    </thead>
    <tbody>${detailRows}</tbody>
  </table>
  <div class="totals">
    <div class="totals-box">
      <div class="totals-row"><span>Total distance</span><span>${totals.km.toFixed(1)} km</span></div>
      <div class="totals-row final"><span>Total SARS deduction</span><span>${fmt(totals.deduction)}</span></div>
    </div>
  </div>
  <div class="footer">
    A record of business kilometres and the SARS travel deduction claimed as at ${esc(asAt)}.<br/>Generated via Worklog — worklog.co.za${
      watermark ? `<br/><strong style="color:#dc2626;">Draft — made on a free Worklog trial.</strong>` : ""
    }
  </div>
</body>
</html>`;
}

// ── Payroll Reports ──────────────────────────────────────────────────────────
// The three tabs of the Payroll Reports tool, printed. Each is the summarised,
// hand-to-your-accountant version of a payroll dashboard: who works here, what
// has been advanced and what is still owed, and where every employee's BCEA
// leave balance stands.

export type StaffRegisterReportRow = {
  name: string;
  employeeNumber: string;
  employmentType: string;
  payType: string;
  rate: number;
  daysPerWeek: number;
  hoursPerDay: number;
  startDate: string;
  monthsEmployed: number;
  monthlyCost: number;
  status: string; // "Active" | "Left 2026-03-31 · Resignation"
};

export function buildStaffRegisterHTML(
  business: BusinessProfile,
  rows: StaffRegisterReportRow[],
  totals: { people: number; employees: number; contractors: number; active: number; left: number; monthlyWageBill: number },
  asAt: string,
  watermark = false
): string {
  const detailRows = rows.length
    ? rows
        .map(
          (r) => `
      <tr>
        <td>${esc(r.name)}${r.employeeNumber ? `<br/><span style="font-size:10px;color:#94a3b8;">${esc(r.employeeNumber)}</span>` : ""}</td>
        <td>${esc(r.employmentType)}</td>
        <td>${esc(r.payType)} · ${fmt(r.rate)}</td>
        <td style="text-align:center;">${r.daysPerWeek || "—"}${r.daysPerWeek ? `d × ${r.hoursPerDay || 0}h` : ""}</td>
        <td>${esc(r.startDate || "—")}${r.startDate ? `<br/><span style="font-size:10px;color:#94a3b8;">${r.monthsEmployed} months</span>` : ""}</td>
        <td>${esc(r.status)}</td>
        <td style="text-align:right;font-weight:700;">${fmt(r.monthlyCost)}</td>
      </tr>`
        )
        .join("")
    : `<tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:16px;">Nobody on the register yet.</td></tr>`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><title>Staff Register</title><style>${SHARED_CSS}</style></head>
<body>
  ${watermark ? `<div class="wm">TRIAL — NOT FINAL</div>` : ""}
  ${header(business, "STAFF REGISTER", `As at ${asAt}`)}
  <div class="meta-row">
    ${fromBlock(business, "Prepared by")}
    <div style="text-align:right;">
      <div class="meta-label">Report</div>
      <div style="font-size:20px;font-weight:800;">Everyone on the books</div>
    </div>
  </div>
  <div style="font-size:11px;font-weight:700;color:#0C4A6E;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:10px;">Summary</div>
  <table>
    <thead><tr><th style="text-align:center;">People</th><th style="text-align:center;">Employees</th><th style="text-align:center;">Contractors</th><th style="text-align:center;">Currently employed</th><th style="text-align:center;">Left</th></tr></thead>
    <tbody><tr>
      <td style="text-align:center;font-weight:700;">${totals.people}</td>
      <td style="text-align:center;font-weight:700;">${totals.employees}</td>
      <td style="text-align:center;font-weight:700;">${totals.contractors}</td>
      <td style="text-align:center;font-weight:700;">${totals.active}</td>
      <td style="text-align:center;font-weight:700;">${totals.left}</td>
    </tr></tbody>
  </table>
  <div style="font-size:11px;font-weight:700;color:#0C4A6E;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:10px;">People</div>
  <table>
    <thead>
      <tr><th>Name</th><th>Type</th><th>Pay</th><th style="text-align:center;">Per week</th><th>Started</th><th>Status</th><th style="text-align:right;">Est. per month</th></tr>
    </thead>
    <tbody>${detailRows}</tbody>
  </table>
  <div class="totals">
    <div class="totals-box">
      <div class="totals-row"><span>Currently employed</span><span>${totals.active}</span></div>
      <div class="totals-row final"><span>Est. monthly wage bill</span><span>${fmt(totals.monthlyWageBill)}</span></div>
    </div>
  </div>
  <div class="footer">
    The people on the register as at ${esc(asAt)}. The monthly figure is an estimate from each person's pay type, rate and standing allowance — a pay run's actual gross is what gets paid and filed.<br/>Generated via Worklog — worklog.co.za${
      watermark ? `<br/><strong style="color:#dc2626;">Draft — made on a free Worklog trial.</strong>` : ""
    }
  </div>
</body>
</html>`;
}

export type AdvancesReportRow = {
  name: string;
  advanced: number;
  repaid: number;
  balance: number;
  repayPerRun: number;
  runsLeft: number | null;
};
export type AdvancesReportEntry = { name: string; date: string; type: string; amount: number; note: string };

export function buildAdvancesReportHTML(
  business: BusinessProfile,
  rows: AdvancesReportRow[],
  entries: AdvancesReportEntry[],
  totals: { advanced: number; repaid: number; outstanding: number; people: number },
  asAt: string,
  watermark = false
): string {
  const balanceRows = rows.length
    ? rows
        .map(
          (r) => `
      <tr>
        <td>${esc(r.name)}</td>
        <td style="text-align:right;">${fmt(r.advanced)}</td>
        <td style="text-align:right;">${fmt(r.repaid)}</td>
        <td>${r.repayPerRun > 0 ? `${fmt(r.repayPerRun)}/run${r.runsLeft ? ` · ~${r.runsLeft} left` : ""}` : "—"}</td>
        <td style="text-align:right;font-weight:700;color:${r.balance > 0 ? "#92400e" : "#111"};">${fmt(r.balance)}</td>
      </tr>`
        )
        .join("")
    : `<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:16px;">No advances recorded.</td></tr>`;

  const entryRows = entries.length
    ? entries
        .map(
          (e) => `
      <tr>
        <td>${esc(e.date)}</td>
        <td>${esc(e.name)}</td>
        <td>${esc(e.type)}</td>
        <td>${esc(e.note || "—")}</td>
        <td style="text-align:right;font-weight:700;">${fmt(e.amount)}</td>
      </tr>`
        )
        .join("")
    : "";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><title>Advances Report</title><style>${SHARED_CSS}</style></head>
<body>
  ${watermark ? `<div class="wm">TRIAL — NOT FINAL</div>` : ""}
  ${header(business, "ADVANCES", `As at ${asAt}`)}
  <div class="meta-row">
    ${fromBlock(business, "Prepared by")}
    <div style="text-align:right;">
      <div class="meta-label">Report</div>
      <div style="font-size:20px;font-weight:800;">Advances &amp; what is still owed</div>
    </div>
  </div>
  <div style="font-size:11px;font-weight:700;color:#0C4A6E;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:10px;">Balances</div>
  <table>
    <thead>
      <tr><th>Employee</th><th style="text-align:right;">Advanced</th><th style="text-align:right;">Repaid</th><th>Deduction plan</th><th style="text-align:right;">Outstanding</th></tr>
    </thead>
    <tbody>${balanceRows}</tbody>
  </table>
  ${
    entryRows
      ? `<div style="font-size:11px;font-weight:700;color:#0C4A6E;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:10px;">Every entry</div>
  <table>
    <thead><tr><th>Date</th><th>Employee</th><th>Entry</th><th>Note</th><th style="text-align:right;">Amount</th></tr></thead>
    <tbody>${entryRows}</tbody>
  </table>`
      : ""
  }
  <div class="totals">
    <div class="totals-box">
      <div class="totals-row"><span>Total advanced</span><span>${fmt(totals.advanced)}</span></div>
      <div class="totals-row"><span>Total repaid</span><span>${fmt(totals.repaid)}</span></div>
      <div class="totals-row final"><span>Still owed by ${totals.people} ${totals.people === 1 ? "person" : "people"}</span><span>${fmt(totals.outstanding)}</span></div>
    </div>
  </div>
  <div class="footer">
    Advances given to staff and the repayments Pay Run has deducted from wages, as at ${esc(asAt)}.<br/>Generated via Worklog — worklog.co.za${
      watermark ? `<br/><strong style="color:#dc2626;">Draft — made on a free Worklog trial.</strong>` : ""
    }
  </div>
</body>
</html>`;
}

export type LeaveReportRowOut = {
  name: string;
  startDate: string;
  months: number;
  annualAccrued: number;
  annualTaken: number;
  annualBalance: number;
  sickTaken: number;
  sickBalance: number;
  familyTaken: number;
  familyBalance: number;
  status: string;
};
export type LeaveReportEntry = { name: string; date: string; endDate: string; type: string; days: number; note: string };

export function buildLeaveReportHTML(
  business: BusinessProfile,
  rows: LeaveReportRowOut[],
  entries: LeaveReportEntry[],
  totals: { annual: number; sick: number; family: number; other: number; days: number },
  asAt: string,
  watermark = false
): string {
  const d = (n: number) => `${n}d`;
  const balanceRows = rows.length
    ? rows
        .map(
          (r) => `
      <tr>
        <td>${esc(r.name)}${r.startDate ? `<br/><span style="font-size:10px;color:#94a3b8;">from ${esc(r.startDate)} · ${r.months} months</span>` : ""}</td>
        <td style="text-align:center;">${d(r.annualAccrued)}</td>
        <td style="text-align:center;">${d(r.annualTaken)}</td>
        <td style="text-align:center;font-weight:700;color:#0C4A6E;">${d(r.annualBalance)}</td>
        <td style="text-align:center;">${d(r.sickTaken)} / ${d(r.sickBalance)}</td>
        <td style="text-align:center;">${d(r.familyTaken)} / ${d(r.familyBalance)}</td>
        <td>${esc(r.status)}</td>
      </tr>`
        )
        .join("")
    : `<tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:16px;">No employees to report on.</td></tr>`;

  const entryRows = entries.length
    ? entries
        .map(
          (e) => `
      <tr>
        <td>${esc(e.date)}${e.endDate ? ` → ${esc(e.endDate)}` : ""}</td>
        <td>${esc(e.name)}</td>
        <td>${esc(e.type)}</td>
        <td>${esc(e.note || "—")}</td>
        <td style="text-align:right;font-weight:700;">${d(e.days)}</td>
      </tr>`
        )
        .join("")
    : "";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><title>Leave Report</title><style>${SHARED_CSS}</style></head>
<body>
  ${watermark ? `<div class="wm">TRIAL — NOT FINAL</div>` : ""}
  ${header(business, "LEAVE", `As at ${asAt}`)}
  <div class="meta-row">
    ${fromBlock(business, "Prepared by")}
    <div style="text-align:right;">
      <div class="meta-label">Report</div>
      <div style="font-size:20px;font-weight:800;">Leave taken &amp; BCEA balances</div>
    </div>
  </div>
  <div style="font-size:11px;font-weight:700;color:#0C4A6E;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:10px;">Balances per employee</div>
  <table>
    <thead>
      <tr><th>Employee</th><th style="text-align:center;">Annual accrued</th><th style="text-align:center;">Annual taken</th><th style="text-align:center;">Annual left</th><th style="text-align:center;">Sick taken / left</th><th style="text-align:center;">Family taken / left</th><th>Status</th></tr>
    </thead>
    <tbody>${balanceRows}</tbody>
  </table>
  ${
    entryRows
      ? `<div style="font-size:11px;font-weight:700;color:#0C4A6E;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:10px;">Every leave entry</div>
  <table>
    <thead><tr><th>Dates</th><th>Employee</th><th>Type</th><th>Note</th><th style="text-align:right;">Days</th></tr></thead>
    <tbody>${entryRows}</tbody>
  </table>`
      : ""
  }
  <div class="totals">
    <div class="totals-box">
      <div class="totals-row"><span>Annual leave taken</span><span>${d(totals.annual)}</span></div>
      <div class="totals-row"><span>Sick leave taken</span><span>${d(totals.sick)}</span></div>
      <div class="totals-row"><span>Family responsibility taken</span><span>${d(totals.family)}</span></div>
      ${totals.other > 0 ? `<div class="totals-row"><span>Other leave taken</span><span>${d(totals.other)}</span></div>` : ""}
      <div class="totals-row final"><span>Total days taken</span><span>${d(totals.days)}</span></div>
    </div>
  </div>
  <div class="footer">
    BCEA leave balances as at ${esc(asAt)}: annual accrues at 1.25 days a month, sick leave runs on a 30-day three-year cycle, and family responsibility leave is 3 days a year. Confirm any payout figure with your accountant.<br/>Generated via Worklog — worklog.co.za${
      watermark ? `<br/><strong style="color:#dc2626;">Draft — made on a free Worklog trial.</strong>` : ""
    }
  </div>
</body>
</html>`;
}

// ── Scheduling Reports: Diary ────────────────────────────────────────────────

export type DiaryReportStatusRow = { label: string; count: number; value: number; hours: number };
export type DiaryReportClientRow = { name: string; appointments: number; value: number; noShows: number };

export function buildDiaryReportHTML(
  business: BusinessProfile,
  statuses: DiaryReportStatusRow[],
  clients: DiaryReportClientRow[],
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
  },
  asAt: string,
  watermark = false,
  periodLabel?: string
): string {
  const pct = (n: number) => `${n.toFixed(0)}%`;
  const statusRows = statuses.length
    ? statuses
        .map(
          (s) => `
      <tr>
        <td>${esc(s.label)}</td>
        <td style="text-align:center;">${s.count}</td>
        <td style="text-align:right;">${s.hours.toFixed(1)}h</td>
        <td style="text-align:right;font-weight:700;">${fmt(s.value)}</td>
      </tr>`
        )
        .join("")
    : `<tr><td colspan="4" style="text-align:center;color:#94a3b8;padding:16px;">No appointments in this period.</td></tr>`;

  const clientRows = clients.length
    ? clients
        .map(
          (c) => `
      <tr>
        <td>${esc(c.name)}</td>
        <td style="text-align:center;">${c.appointments}</td>
        <td style="text-align:center;color:${c.noShows > 0 ? "#be123c" : "#94a3b8"};">${c.noShows || "—"}</td>
        <td style="text-align:right;font-weight:700;">${fmt(c.value)}</td>
      </tr>`
        )
        .join("")
    : "";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><title>Diary Report</title><style>${SHARED_CSS}</style></head>
<body>
  ${watermark ? `<div class="wm">TRIAL — NOT FINAL</div>` : ""}
  ${header(business, "DIARY REPORT", periodLabel ? `${periodLabel} · as at ${asAt}` : `As at ${asAt}`)}
  <div class="meta-row">
    ${fromBlock(business, "Prepared by")}
    <div style="text-align:right;">
      <div class="meta-label">Report</div>
      <div style="font-size:20px;font-weight:800;">Appointments &amp; what came of them</div>
      ${periodLabel ? `<div style="font-size:12px;color:#64748b;margin-top:2px;">${esc(periodLabel)}</div>` : ""}
    </div>
  </div>
  <div style="font-size:11px;font-weight:700;color:#0C4A6E;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:10px;">Summary</div>
  <table>
    <thead><tr><th style="text-align:center;">Appointments</th><th style="text-align:center;">Hours booked</th><th style="text-align:center;">No-show rate</th><th style="text-align:center;">Cancelled</th><th style="text-align:center;">On-site / in-house</th></tr></thead>
    <tbody><tr>
      <td style="text-align:center;font-weight:700;">${totals.appointments}</td>
      <td style="text-align:center;font-weight:700;">${totals.hours.toFixed(1)}h</td>
      <td style="text-align:center;font-weight:700;color:${totals.noShowRate > 0 ? "#be123c" : "#111"};">${pct(totals.noShowRate)}</td>
      <td style="text-align:center;font-weight:700;">${pct(totals.cancelRate)}</td>
      <td style="text-align:center;font-weight:700;">${totals.onsite} / ${totals.inHouse}</td>
    </tr></tbody>
  </table>
  <div style="font-size:11px;font-weight:700;color:#0C4A6E;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:10px;">By status</div>
  <table>
    <thead><tr><th>Status</th><th style="text-align:center;">Appointments</th><th style="text-align:right;">Hours</th><th style="text-align:right;">Value</th></tr></thead>
    <tbody>${statusRows}</tbody>
  </table>
  ${
    clientRows
      ? `<div style="font-size:11px;font-weight:700;color:#0C4A6E;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:10px;">By client</div>
  <table>
    <thead><tr><th>Client</th><th style="text-align:center;">Appointments</th><th style="text-align:center;">No-shows</th><th style="text-align:right;">Value</th></tr></thead>
    <tbody>${clientRows}</tbody>
  </table>`
      : ""
  }
  <div class="totals">
    <div class="totals-box">
      <div class="totals-row"><span>Booked</span><span>${fmt(totals.booked)}</span></div>
      <div class="totals-row"><span>Lost to no-shows &amp; cancellations</span><span>${fmt(totals.lost)}</span></div>
      <div class="totals-row"><span>Deposits taken</span><span>${fmt(totals.deposits)}</span></div>
      <div class="totals-row"><span>Still to collect on completed work</span><span>${fmt(totals.outstanding)}</span></div>
      <div class="totals-row final"><span>Completed</span><span>${fmt(totals.completed)}</span></div>
    </div>
  </div>
  <div class="footer">
    Appointments in the diary${periodLabel ? ` for ${esc(periodLabel.toLowerCase())}` : ""}, as at ${esc(asAt)}. "Completed" counts only appointments marked complete — booked value includes work that has not happened yet.<br/>Generated via Worklog — worklog.co.za${
      watermark ? `<br/><strong style="color:#dc2626;">Draft — made on a free Worklog trial.</strong>` : ""
    }
  </div>
</body>
</html>`;
}

// ── Sales Reports ────────────────────────────────────────────────────────────

export type SalesSummaryPdfRow = { month: string; invoices: number; invoiced: number; vat: number; credited: number; net: number; received: number; outstanding: number };
export type QuoteConversionPdfRow = { label: string; count: number; value: number };
export type SoldItemPdfRow = { description: string; qty: number; value: number; invoices: number };
export type RecurringPdfRow = { client: string; docNumber: string; recurrenceLabel: string; nextRun: string; amount: number; perMonth: number };

export function buildSalesSummaryHTML(
  business: BusinessProfile,
  rows: SalesSummaryPdfRow[],
  totals: { invoices: number; invoiced: number; vat: number; credited: number; net: number; received: number; outstanding: number; collectedPct: number },
  asAt: string,
  watermark = false,
  periodLabel?: string
): string {
  const body = rows.length
    ? rows
        .map(
          (r) => `
      <tr>
        <td>${esc(r.month)}</td>
        <td style="text-align:center;">${r.invoices}</td>
        <td style="text-align:right;">${fmt(r.invoiced)}</td>
        <td style="text-align:right;">${fmt(r.vat)}</td>
        <td style="text-align:right;color:${r.credited > 0 ? "#be123c" : "#94a3b8"};">${r.credited > 0 ? `−${fmt(r.credited)}` : "—"}</td>
        <td style="text-align:right;font-weight:700;">${fmt(r.net)}</td>
        <td style="text-align:right;">${fmt(r.received)}</td>
        <td style="text-align:right;color:${r.outstanding > 0 ? "#92400e" : "#111"};">${fmt(r.outstanding)}</td>
      </tr>`
        )
        .join("")
    : `<tr><td colspan="8" style="text-align:center;color:#94a3b8;padding:16px;">No invoices in this period.</td></tr>`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><title>Sales Summary</title><style>${SHARED_CSS}</style></head>
<body>
  ${watermark ? `<div class="wm">TRIAL — NOT FINAL</div>` : ""}
  ${header(business, "SALES SUMMARY", periodLabel ? `${periodLabel} · as at ${asAt}` : `As at ${asAt}`)}
  <div class="meta-row">
    ${fromBlock(business, "Prepared by")}
    <div style="text-align:right;">
      <div class="meta-label">Report</div>
      <div style="font-size:20px;font-weight:800;">Invoiced against collected</div>
      ${periodLabel ? `<div style="font-size:12px;color:#64748b;margin-top:2px;">${esc(periodLabel)}</div>` : ""}
    </div>
  </div>
  <table>
    <thead>
      <tr><th>Month</th><th style="text-align:center;">Invoices</th><th style="text-align:right;">Invoiced</th><th style="text-align:right;">VAT</th><th style="text-align:right;">Credit notes</th><th style="text-align:right;">Net sales</th><th style="text-align:right;">Received</th><th style="text-align:right;">Outstanding</th></tr>
    </thead>
    <tbody>${body}</tbody>
  </table>
  <div class="totals">
    <div class="totals-box">
      <div class="totals-row"><span>Invoiced (excl. VAT)</span><span>${fmt(totals.invoiced)}</span></div>
      <div class="totals-row"><span>VAT</span><span>${fmt(totals.vat)}</span></div>
      <div class="totals-row"><span>Credit notes</span><span>−${fmt(totals.credited)}</span></div>
      <div class="totals-row"><span>Received</span><span>${fmt(totals.received)} (${totals.collectedPct.toFixed(0)}%)</span></div>
      <div class="totals-row"><span>Still outstanding</span><span>${fmt(totals.outstanding)}</span></div>
      <div class="totals-row final"><span>Net sales</span><span>${fmt(totals.net)}</span></div>
    </div>
  </div>
  <div class="footer">
    Sales by month as at ${esc(asAt)}. Net sales is what was invoiced excluding VAT, less credit notes. Received counts a paid invoice in full and a part-paid one at its deposit.<br/>Generated via Worklog — worklog.co.za${
      watermark ? `<br/><strong style="color:#dc2626;">Draft — made on a free Worklog trial.</strong>` : ""
    }
  </div>
</body>
</html>`;
}

export function buildQuoteConversionHTML(
  business: BusinessProfile,
  rows: QuoteConversionPdfRow[],
  totals: { quotes: number; value: number; won: number; wonValue: number; lost: number; lostValue: number; open: number; openValue: number; conversionRate: number },
  asAt: string,
  watermark = false,
  periodLabel?: string
): string {
  const body = rows.length
    ? rows
        .map(
          (r) => `
      <tr>
        <td>${esc(r.label)}</td>
        <td style="text-align:center;">${r.count}</td>
        <td style="text-align:center;">${totals.quotes ? ((r.count / totals.quotes) * 100).toFixed(0) : 0}%</td>
        <td style="text-align:right;font-weight:700;">${fmt(r.value)}</td>
      </tr>`
        )
        .join("")
    : `<tr><td colspan="4" style="text-align:center;color:#94a3b8;padding:16px;">No quotes in this period.</td></tr>`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><title>Quote Conversion</title><style>${SHARED_CSS}</style></head>
<body>
  ${watermark ? `<div class="wm">TRIAL — NOT FINAL</div>` : ""}
  ${header(business, "QUOTE CONVERSION", periodLabel ? `${periodLabel} · as at ${asAt}` : `As at ${asAt}`)}
  <div class="meta-row">
    ${fromBlock(business, "Prepared by")}
    <div style="text-align:right;">
      <div class="meta-label">Report</div>
      <div style="font-size:20px;font-weight:800;">What became of every quote</div>
      ${periodLabel ? `<div style="font-size:12px;color:#64748b;margin-top:2px;">${esc(periodLabel)}</div>` : ""}
    </div>
  </div>
  <div style="font-size:11px;font-weight:700;color:#0C4A6E;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:10px;">Summary</div>
  <table>
    <thead><tr><th style="text-align:center;">Quotes</th><th style="text-align:center;">Won</th><th style="text-align:center;">Lost</th><th style="text-align:center;">Still open</th><th style="text-align:center;">Conversion</th></tr></thead>
    <tbody><tr>
      <td style="text-align:center;font-weight:700;">${totals.quotes}</td>
      <td style="text-align:center;font-weight:700;color:#0369A1;">${totals.won}</td>
      <td style="text-align:center;font-weight:700;color:#be123c;">${totals.lost}</td>
      <td style="text-align:center;font-weight:700;">${totals.open}</td>
      <td style="text-align:center;font-weight:700;">${totals.conversionRate.toFixed(0)}%</td>
    </tr></tbody>
  </table>
  <div style="font-size:11px;font-weight:700;color:#0C4A6E;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:10px;">Outcomes</div>
  <table>
    <thead><tr><th>Outcome</th><th style="text-align:center;">Quotes</th><th style="text-align:center;">Share</th><th style="text-align:right;">Value</th></tr></thead>
    <tbody>${body}</tbody>
  </table>
  <div class="totals">
    <div class="totals-box">
      <div class="totals-row"><span>Value won</span><span>${fmt(totals.wonValue)}</span></div>
      <div class="totals-row"><span>Value lost</span><span>${fmt(totals.lostValue)}</span></div>
      <div class="totals-row"><span>Still open</span><span>${fmt(totals.openValue)}</span></div>
      <div class="totals-row final"><span>Quoted in total</span><span>${fmt(totals.value)}</span></div>
    </div>
  </div>
  <div class="footer">
    Quotes issued${periodLabel ? ` in ${esc(periodLabel.toLowerCase())}` : ""}, as at ${esc(asAt)}. Conversion is quotes won as a share of those decided — quotes still open aren't counted against you. A quote past its valid-until date with no decision is counted as expired.<br/>Generated via Worklog — worklog.co.za${
      watermark ? `<br/><strong style="color:#dc2626;">Draft — made on a free Worklog trial.</strong>` : ""
    }
  </div>
</body>
</html>`;
}

export function buildWhatSellsHTML(
  business: BusinessProfile,
  rows: SoldItemPdfRow[],
  totals: { lines: number; value: number },
  asAt: string,
  watermark = false,
  periodLabel?: string
): string {
  const body = rows.length
    ? rows
        .map(
          (r) => `
      <tr>
        <td>${esc(r.description)}</td>
        <td style="text-align:center;">${r.qty % 1 === 0 ? r.qty : r.qty.toFixed(2)}</td>
        <td style="text-align:center;">${r.invoices}</td>
        <td style="text-align:center;">${totals.value > 0 ? ((r.value / totals.value) * 100).toFixed(0) : 0}%</td>
        <td style="text-align:right;font-weight:700;">${fmt(r.value)}</td>
      </tr>`
        )
        .join("")
    : `<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:16px;">No invoice lines in this period.</td></tr>`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><title>What Sells</title><style>${SHARED_CSS}</style></head>
<body>
  ${watermark ? `<div class="wm">TRIAL — NOT FINAL</div>` : ""}
  ${header(business, "WHAT SELLS", periodLabel ? `${periodLabel} · as at ${asAt}` : `As at ${asAt}`)}
  <div class="meta-row">
    ${fromBlock(business, "Prepared by")}
    <div style="text-align:right;">
      <div class="meta-label">Report</div>
      <div style="font-size:20px;font-weight:800;">Invoice lines, best first</div>
      ${periodLabel ? `<div style="font-size:12px;color:#64748b;margin-top:2px;">${esc(periodLabel)}</div>` : ""}
    </div>
  </div>
  <table>
    <thead><tr><th>Line</th><th style="text-align:center;">Qty</th><th style="text-align:center;">Invoices</th><th style="text-align:center;">Share</th><th style="text-align:right;">Value</th></tr></thead>
    <tbody>${body}</tbody>
  </table>
  <div class="totals">
    <div class="totals-box">
      <div class="totals-row"><span>Distinct lines</span><span>${totals.lines}</span></div>
      <div class="totals-row final"><span>Total invoiced on lines</span><span>${fmt(totals.value)}</span></div>
    </div>
  </div>
  <div class="footer">
    Invoice lines grouped by description as at ${esc(asAt)}, excluding VAT. Lines are matched on the words typed on them, so consistent naming makes this report sharper.<br/>Generated via Worklog — worklog.co.za${
      watermark ? `<br/><strong style="color:#dc2626;">Draft — made on a free Worklog trial.</strong>` : ""
    }
  </div>
</body>
</html>`;
}

export function buildRecurringRevenueHTML(
  business: BusinessProfile,
  rows: RecurringPdfRow[],
  totals: { count: number; perMonth: number; dueSoon: number },
  asAt: string,
  watermark = false
): string {
  const body = rows.length
    ? rows
        .map(
          (r) => `
      <tr>
        <td>${esc(r.client)}${r.docNumber ? `<br/><span style="font-size:10px;color:#94a3b8;">${esc(r.docNumber)}</span>` : ""}</td>
        <td>${esc(r.recurrenceLabel)}</td>
        <td>${esc(r.nextRun || "—")}</td>
        <td style="text-align:right;">${fmt(r.amount)}</td>
        <td style="text-align:right;font-weight:700;">${fmt(r.perMonth)}</td>
      </tr>`
        )
        .join("")
    : `<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:16px;">No recurring invoices set up.</td></tr>`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><title>Recurring Revenue</title><style>${SHARED_CSS}</style></head>
<body>
  ${watermark ? `<div class="wm">TRIAL — NOT FINAL</div>` : ""}
  ${header(business, "RECURRING REVENUE", `As at ${asAt}`)}
  <div class="meta-row">
    ${fromBlock(business, "Prepared by")}
    <div style="text-align:right;">
      <div class="meta-label">Report</div>
      <div style="font-size:20px;font-weight:800;">What bills itself every month</div>
    </div>
  </div>
  <table>
    <thead><tr><th>Customer</th><th>Every</th><th>Next run</th><th style="text-align:right;">Per run</th><th style="text-align:right;">Per month</th></tr></thead>
    <tbody>${body}</tbody>
  </table>
  <div class="totals">
    <div class="totals-box">
      <div class="totals-row"><span>Recurring invoices</span><span>${totals.count}</span></div>
      <div class="totals-row"><span>Billing in the next 30 days</span><span>${fmt(totals.dueSoon)}</span></div>
      <div class="totals-row final"><span>Committed per month</span><span>${fmt(totals.perMonth)}</span></div>
    </div>
  </div>
  <div class="footer">
    Live recurring invoices as at ${esc(asAt)}, VAT included. Weekly, quarterly and annual schedules are stated as a monthly equivalent so they can be added together — an annual invoice is a twelfth of itself each month, not a monthly commitment.<br/>Generated via Worklog — worklog.co.za${
      watermark ? `<br/><strong style="color:#dc2626;">Draft — made on a free Worklog trial.</strong>` : ""
    }
  </div>
</body>
</html>`;
}

// ── Price List Reports ───────────────────────────────────────────────────────

export type StockValuePdfRow = { name: string; typeLabel: string; qty: number; costPrice: number; sellPrice: number; atCost: number; atSell: number };
export type MarginPdfRow = { name: string; typeLabel: string; costPrice: number; sellPrice: number; marginPct: number; markupPct: number; profit: number; atRisk: boolean; unpriced: boolean };
export type ReorderPdfRow = { name: string; typeLabel: string; qty: number; reorderLevel: number; shortBy: number; costPrice: number; costToRestock: number; outOfStock: boolean };
export type CostingDriftPdfRow = { name: string; totalCost: number; markupPct: number; suggestedPrice: number; itemName: string; listedPrice: number | null; difference: number; linked: boolean; under: boolean };

const qtyText = (n: number) => (n % 1 === 0 ? String(n) : n.toFixed(2));

export function buildStockOnHandHTML(
  business: BusinessProfile,
  rows: StockValuePdfRow[],
  totals: { items: number; units: number; atCost: number; atSell: number; potential: number },
  asAt: string,
  watermark = false
): string {
  const body = rows.length
    ? rows
        .map(
          (r) => `
      <tr>
        <td>${esc(r.name)}</td>
        <td>${esc(r.typeLabel)}</td>
        <td style="text-align:center;">${qtyText(r.qty)}</td>
        <td style="text-align:right;">${fmt(r.costPrice)}</td>
        <td style="text-align:right;">${fmt(r.sellPrice)}</td>
        <td style="text-align:right;font-weight:700;">${fmt(r.atCost)}</td>
        <td style="text-align:right;">${fmt(r.atSell)}</td>
      </tr>`
        )
        .join("")
    : `<tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:16px;">Nothing on the price list carries stock.</td></tr>`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><title>Stock on Hand</title><style>${SHARED_CSS}</style></head>
<body>
  ${watermark ? `<div class="wm">TRIAL — NOT FINAL</div>` : ""}
  ${header(business, "STOCK ON HAND", `As at ${asAt}`)}
  <div class="meta-row">
    ${fromBlock(business, "Prepared by")}
    <div style="text-align:right;">
      <div class="meta-label">Report</div>
      <div style="font-size:20px;font-weight:800;">What you hold, and what it's worth</div>
    </div>
  </div>
  <table>
    <thead><tr><th>Item</th><th>Type</th><th style="text-align:center;">Qty</th><th style="text-align:right;">Cost each</th><th style="text-align:right;">Sells for</th><th style="text-align:right;">Value at cost</th><th style="text-align:right;">Value at sell</th></tr></thead>
    <tbody>${body}</tbody>
  </table>
  <div class="totals">
    <div class="totals-box">
      <div class="totals-row"><span>Items carrying stock</span><span>${totals.items}</span></div>
      <div class="totals-row"><span>Units held</span><span>${qtyText(totals.units)}</span></div>
      <div class="totals-row"><span>Value at sell price</span><span>${fmt(totals.atSell)}</span></div>
      <div class="totals-row"><span>Profit if it all sells</span><span>${fmt(totals.potential)}</span></div>
      <div class="totals-row final"><span>Closing stock at cost</span><span>${fmt(totals.atCost)}</span></div>
    </div>
  </div>
  <div class="footer">
    Stock held as at ${esc(asAt)}, valued at cost — the figure an accountant asks for as closing stock. Services, labour and packages carry no stock and are not listed.<br/>Generated via Worklog — worklog.co.za${
      watermark ? `<br/><strong style="color:#dc2626;">Draft — made on a free Worklog trial.</strong>` : ""
    }
  </div>
</body>
</html>`;
}

export function buildMarginsHTML(
  business: BusinessProfile,
  rows: MarginPdfRow[],
  totals: { items: number; priced: number; atRisk: number; unpriced: number; averageMargin: number },
  asAt: string,
  watermark = false
): string {
  const body = rows.length
    ? rows
        .map(
          (r) => `
      <tr>
        <td>${esc(r.name)}${r.atRisk ? ` <span style="color:#be123c;font-weight:700;">⚠</span>` : ""}</td>
        <td>${esc(r.typeLabel)}</td>
        <td style="text-align:right;">${fmt(r.costPrice)}</td>
        <td style="text-align:right;">${r.unpriced ? "—" : fmt(r.sellPrice)}</td>
        <td style="text-align:right;">${r.unpriced ? "—" : fmt(r.profit)}</td>
        <td style="text-align:center;">${r.unpriced ? "—" : `${r.markupPct.toFixed(0)}%`}</td>
        <td style="text-align:center;font-weight:700;color:${r.unpriced ? "#94a3b8" : r.atRisk ? "#be123c" : "#111"};">${r.unpriced ? "No price" : `${r.marginPct.toFixed(0)}%`}</td>
      </tr>`
        )
        .join("")
    : `<tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:16px;">Nothing on the price list yet.</td></tr>`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><title>Margins</title><style>${SHARED_CSS}</style></head>
<body>
  ${watermark ? `<div class="wm">TRIAL — NOT FINAL</div>` : ""}
  ${header(business, "MARGINS", `As at ${asAt}`)}
  <div class="meta-row">
    ${fromBlock(business, "Prepared by")}
    <div style="text-align:right;">
      <div class="meta-label">Report</div>
      <div style="font-size:20px;font-weight:800;">What you make on every item</div>
    </div>
  </div>
  <table>
    <thead><tr><th>Item</th><th>Type</th><th style="text-align:right;">Cost</th><th style="text-align:right;">Sells for</th><th style="text-align:right;">Profit</th><th style="text-align:center;">Markup</th><th style="text-align:center;">Margin</th></tr></thead>
    <tbody>${body}</tbody>
  </table>
  <div class="totals">
    <div class="totals-box">
      <div class="totals-row"><span>Items priced</span><span>${totals.priced} of ${totals.items}</span></div>
      <div class="totals-row"><span>Selling at or below cost</span><span style="color:${totals.atRisk > 0 ? "#be123c" : "#111"};">${totals.atRisk}</span></div>
      <div class="totals-row"><span>No sell price set</span><span>${totals.unpriced}</span></div>
      <div class="totals-row final"><span>Average margin</span><span>${totals.averageMargin.toFixed(0)}%</span></div>
    </div>
  </div>
  <div class="footer">
    Worst margin first, as at ${esc(asAt)}. Margin is profit as a share of what you charge; markup is the same profit as a share of what it cost you. The average is of each item's margin, so one expensive line doesn't drown out the rest.<br/>Generated via Worklog — worklog.co.za${
      watermark ? `<br/><strong style="color:#dc2626;">Draft — made on a free Worklog trial.</strong>` : ""
    }
  </div>
</body>
</html>`;
}

export function buildReorderHTML(
  business: BusinessProfile,
  rows: ReorderPdfRow[],
  totals: { items: number; outOfStock: number; costToRestock: number },
  asAt: string,
  watermark = false
): string {
  const body = rows.length
    ? rows
        .map(
          (r) => `
      <tr>
        <td>${esc(r.name)}${r.outOfStock ? ` <span style="color:#be123c;font-weight:700;">out</span>` : ""}</td>
        <td>${esc(r.typeLabel)}</td>
        <td style="text-align:center;">${qtyText(r.qty)}</td>
        <td style="text-align:center;">${qtyText(r.reorderLevel)}</td>
        <td style="text-align:center;font-weight:700;">${qtyText(r.shortBy)}</td>
        <td style="text-align:right;">${fmt(r.costPrice)}</td>
        <td style="text-align:right;font-weight:700;">${fmt(r.costToRestock)}</td>
      </tr>`
        )
        .join("")
    : `<tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:16px;">Nothing needs reordering.</td></tr>`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><title>Reorder List</title><style>${SHARED_CSS}</style></head>
<body>
  ${watermark ? `<div class="wm">TRIAL — NOT FINAL</div>` : ""}
  ${header(business, "REORDER LIST", `As at ${asAt}`)}
  <div class="meta-row">
    ${fromBlock(business, "Prepared by")}
    <div style="text-align:right;">
      <div class="meta-label">Report</div>
      <div style="font-size:20px;font-weight:800;">What to buy</div>
    </div>
  </div>
  <table>
    <thead><tr><th>Item</th><th>Type</th><th style="text-align:center;">On hand</th><th style="text-align:center;">Reorder at</th><th style="text-align:center;">Short by</th><th style="text-align:right;">Cost each</th><th style="text-align:right;">To restock</th></tr></thead>
    <tbody>${body}</tbody>
  </table>
  <div class="totals">
    <div class="totals-box">
      <div class="totals-row"><span>Items to reorder</span><span>${totals.items}</span></div>
      <div class="totals-row"><span>Already out of stock</span><span style="color:${totals.outOfStock > 0 ? "#be123c" : "#111"};">${totals.outOfStock}</span></div>
      <div class="totals-row final"><span>Cost to restock</span><span>${fmt(totals.costToRestock)}</span></div>
    </div>
  </div>
  <div class="footer">
    Items at or under their reorder level as at ${esc(asAt)}, out-of-stock first. Only items with a reorder level set can appear here.<br/>Generated via Worklog — worklog.co.za${
      watermark ? `<br/><strong style="color:#dc2626;">Draft — made on a free Worklog trial.</strong>` : ""
    }
  </div>
</body>
</html>`;
}

export function buildCostingDriftHTML(
  business: BusinessProfile,
  rows: CostingDriftPdfRow[],
  totals: { costings: number; linked: number; under: number; shortfall: number },
  asAt: string,
  watermark = false
): string {
  const body = rows.length
    ? rows
        .map(
          (r) => `
      <tr>
        <td>${esc(r.name)}${r.itemName && r.itemName !== r.name ? `<br/><span style="font-size:10px;color:#94a3b8;">listed as ${esc(r.itemName)}</span>` : ""}</td>
        <td style="text-align:right;">${fmt(r.totalCost)}</td>
        <td style="text-align:center;">${r.markupPct.toFixed(0)}%</td>
        <td style="text-align:right;">${fmt(r.suggestedPrice)}</td>
        <td style="text-align:right;">${r.linked ? fmt(r.listedPrice ?? 0) : "—"}</td>
        <td style="text-align:right;font-weight:700;color:${r.under ? "#be123c" : r.linked ? "#111" : "#94a3b8"};">${
          r.linked ? `${r.difference >= 0 ? "+" : "−"}${fmt(Math.abs(r.difference))}` : "not on the list"
        }</td>
      </tr>`
        )
        .join("")
    : `<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:16px;">No costings saved yet.</td></tr>`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><title>Costings vs Price List</title><style>${SHARED_CSS}</style></head>
<body>
  ${watermark ? `<div class="wm">TRIAL — NOT FINAL</div>` : ""}
  ${header(business, "COSTINGS VS PRICE LIST", `As at ${asAt}`)}
  <div class="meta-row">
    ${fromBlock(business, "Prepared by")}
    <div style="text-align:right;">
      <div class="meta-label">Report</div>
      <div style="font-size:20px;font-weight:800;">Are you charging what you worked out?</div>
    </div>
  </div>
  <table>
    <thead><tr><th>Costing</th><th style="text-align:right;">Costs you</th><th style="text-align:center;">Markup</th><th style="text-align:right;">Should charge</th><th style="text-align:right;">Actually charging</th><th style="text-align:right;">Difference</th></tr></thead>
    <tbody>${body}</tbody>
  </table>
  <div class="totals">
    <div class="totals-box">
      <div class="totals-row"><span>Costings</span><span>${totals.costings}</span></div>
      <div class="totals-row"><span>On the price list</span><span>${totals.linked}</span></div>
      <div class="totals-row"><span>Priced under the costing</span><span style="color:${totals.under > 0 ? "#be123c" : "#111"};">${totals.under}</span></div>
      <div class="totals-row final"><span>Given away per sale</span><span>${fmt(totals.shortfall)}</span></div>
    </div>
  </div>
  <div class="footer">
    Each costing's suggested price against what the linked price-list item actually sells for, as at ${esc(asAt)}. A costing saved to the price list stays linked, so a price changed afterwards shows up here as a difference.<br/>Generated via Worklog — worklog.co.za${
      watermark ? `<br/><strong style="color:#dc2626;">Draft — made on a free Worklog trial.</strong>` : ""
    }
  </div>
</body>
</html>`;
}

// ── Purchases Reports ────────────────────────────────────────────────────────

export type SupplierSpendPdfRow = { name: string; billed: number; paid: number; outstanding: number; invoices: number; terms: string };
export type CategorySpendPdfRow = { category: string; amount: number; count: number; sharePct: number };
export type CommittedPdfRow = { supplier: string; docNumber: string; issueDate: string; requestedDelivery: string; status: string; amount: number; ageDays: number };
export type BillDuePdfRow = { supplier: string; docNumber: string; dueDate: string; amount: number; bucketLabel: string };

export function buildSupplierSpendHTML(
  business: BusinessProfile,
  rows: SupplierSpendPdfRow[],
  totals: { suppliers: number; billed: number; paid: number; outstanding: number },
  asAt: string,
  watermark = false,
  periodLabel?: string
): string {
  const body = rows.length
    ? rows
        .map(
          (r) => `
      <tr>
        <td>${esc(r.name)}${r.terms ? `<br/><span style="font-size:10px;color:#94a3b8;">${esc(r.terms)}</span>` : ""}</td>
        <td style="text-align:center;">${r.invoices || "—"}</td>
        <td style="text-align:right;">${fmt(r.billed)}</td>
        <td style="text-align:right;">${fmt(r.paid)}</td>
        <td style="text-align:right;font-weight:700;color:${r.outstanding > 0 ? "#92400e" : "#111"};">${fmt(r.outstanding)}</td>
      </tr>`
        )
        .join("")
    : `<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:16px;">No supplier spend in this period.</td></tr>`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><title>Spend by Supplier</title><style>${SHARED_CSS}</style></head>
<body>
  ${watermark ? `<div class="wm">TRIAL — NOT FINAL</div>` : ""}
  ${header(business, "SPEND BY SUPPLIER", periodLabel ? `${periodLabel} · as at ${asAt}` : `As at ${asAt}`)}
  <div class="meta-row">
    ${fromBlock(business, "Prepared by")}
    <div style="text-align:right;">
      <div class="meta-label">Report</div>
      <div style="font-size:20px;font-weight:800;">Who you buy from</div>
      ${periodLabel ? `<div style="font-size:12px;color:#64748b;margin-top:2px;">${esc(periodLabel)}</div>` : ""}
    </div>
  </div>
  <table>
    <thead><tr><th>Supplier</th><th style="text-align:center;">Bills</th><th style="text-align:right;">Billed</th><th style="text-align:right;">Paid out</th><th style="text-align:right;">Still owed</th></tr></thead>
    <tbody>${body}</tbody>
  </table>
  <div class="totals">
    <div class="totals-box">
      <div class="totals-row"><span>Suppliers</span><span>${totals.suppliers}</span></div>
      <div class="totals-row"><span>Billed on supplier invoices</span><span>${fmt(totals.billed)}</span></div>
      <div class="totals-row"><span>Paid out of the expense ledger</span><span>${fmt(totals.paid)}</span></div>
      <div class="totals-row final"><span>Still owed</span><span>${fmt(totals.outstanding)}</span></div>
    </div>
  </div>
  <div class="footer">
    Supplier spend as at ${esc(asAt)}. Billed and paid are two views of the same relationship, not two halves of one total — an expense paid straight to a supplier may never have been billed, so they are shown side by side rather than added.<br/>Generated via Worklog — worklog.co.za${
      watermark ? `<br/><strong style="color:#dc2626;">Draft — made on a free Worklog trial.</strong>` : ""
    }
  </div>
</body>
</html>`;
}

export function buildCategorySpendHTML(
  business: BusinessProfile,
  rows: CategorySpendPdfRow[],
  totals: { total: number; count: number; categories: number; uncategorised: number },
  asAt: string,
  watermark = false,
  periodLabel?: string
): string {
  const body = rows.length
    ? rows
        .map(
          (r) => `
      <tr>
        <td>${esc(r.category)}</td>
        <td style="text-align:center;">${r.count}</td>
        <td style="text-align:center;">${r.sharePct.toFixed(1)}%</td>
        <td style="text-align:right;font-weight:700;">${fmt(r.amount)}</td>
      </tr>`
        )
        .join("")
    : `<tr><td colspan="4" style="text-align:center;color:#94a3b8;padding:16px;">No expenses in this period.</td></tr>`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><title>Spend by Category</title><style>${SHARED_CSS}</style></head>
<body>
  ${watermark ? `<div class="wm">TRIAL — NOT FINAL</div>` : ""}
  ${header(business, "SPEND BY CATEGORY", periodLabel ? `${periodLabel} · as at ${asAt}` : `As at ${asAt}`)}
  <div class="meta-row">
    ${fromBlock(business, "Prepared by")}
    <div style="text-align:right;">
      <div class="meta-label">Report</div>
      <div style="font-size:20px;font-weight:800;">The deduction schedule</div>
      ${periodLabel ? `<div style="font-size:12px;color:#64748b;margin-top:2px;">${esc(periodLabel)}</div>` : ""}
    </div>
  </div>
  <table>
    <thead><tr><th>SARS category</th><th style="text-align:center;">Entries</th><th style="text-align:center;">Share</th><th style="text-align:right;">Amount</th></tr></thead>
    <tbody>${body}</tbody>
  </table>
  <div class="totals">
    <div class="totals-box">
      <div class="totals-row"><span>Categories used</span><span>${totals.categories}</span></div>
      <div class="totals-row"><span>Entries</span><span>${totals.count}</span></div>
      ${totals.uncategorised > 0 ? `<div class="totals-row"><span>Uncategorised</span><span style="color:#b45309;">${fmt(totals.uncategorised)}</span></div>` : ""}
      <div class="totals-row final"><span>Total spend</span><span>${fmt(totals.total)}</span></div>
    </div>
  </div>
  <div class="footer">
    Business expenses by SARS category as at ${esc(asAt)}. Personal spend and credit-note settlements are excluded — neither is a deduction. Confirm the treatment of any category with your accountant.<br/>Generated via Worklog — worklog.co.za${
      watermark ? `<br/><strong style="color:#dc2626;">Draft — made on a free Worklog trial.</strong>` : ""
    }
  </div>
</body>
</html>`;
}

export function buildCommittedHTML(
  business: BusinessProfile,
  rows: CommittedPdfRow[],
  totals: { orders: number; amount: number; overdue: number; overdueAmount: number },
  asAt: string,
  watermark = false
): string {
  const body = rows.length
    ? rows
        .map(
          (r) => `
      <tr>
        <td>${esc(r.supplier)}${r.docNumber ? `<br/><span style="font-size:10px;color:#94a3b8;">${esc(r.docNumber)}</span>` : ""}</td>
        <td>${esc(r.issueDate || "—")}</td>
        <td style="text-align:center;">${r.ageDays}d</td>
        <td>${esc(r.requestedDelivery || "—")}</td>
        <td>${esc(r.status)}</td>
        <td style="text-align:right;font-weight:700;">${fmt(r.amount)}</td>
      </tr>`
        )
        .join("")
    : `<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:16px;">Nothing on order.</td></tr>`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><title>Committed on Order</title><style>${SHARED_CSS}</style></head>
<body>
  ${watermark ? `<div class="wm">TRIAL — NOT FINAL</div>` : ""}
  ${header(business, "COMMITTED ON ORDER", `As at ${asAt}`)}
  <div class="meta-row">
    ${fromBlock(business, "Prepared by")}
    <div style="text-align:right;">
      <div class="meta-label">Report</div>
      <div style="font-size:20px;font-weight:800;">Money promised, not yet billed</div>
    </div>
  </div>
  <table>
    <thead><tr><th>Supplier</th><th>Ordered</th><th style="text-align:center;">Age</th><th>Wanted by</th><th>Status</th><th style="text-align:right;">Value</th></tr></thead>
    <tbody>${body}</tbody>
  </table>
  <div class="totals">
    <div class="totals-box">
      <div class="totals-row"><span>Open orders</span><span>${totals.orders}</span></div>
      <div class="totals-row"><span>Past their delivery date</span><span style="color:${totals.overdue > 0 ? "#be123c" : "#111"};">${totals.overdue} · ${fmt(totals.overdueAmount)}</span></div>
      <div class="totals-row final"><span>Committed on order</span><span>${fmt(totals.amount)}</span></div>
    </div>
  </div>
  <div class="footer">
    Purchase orders raised but not yet billed as at ${esc(asAt)}, VAT included — spend you have committed to that hasn't reached your books. An order drops off this list as soon as a supplier invoice links back to it.<br/>Generated via Worklog — worklog.co.za${
      watermark ? `<br/><strong style="color:#dc2626;">Draft — made on a free Worklog trial.</strong>` : ""
    }
  </div>
</body>
</html>`;
}

export function buildBillsDueHTML(
  business: BusinessProfile,
  rows: BillDuePdfRow[],
  totals: { overdue: number; week: number; month: number; later: number; undated: number; total: number; count: number },
  asAt: string,
  watermark = false
): string {
  const body = rows.length
    ? rows
        .map(
          (r) => `
      <tr>
        <td>${esc(r.supplier)}${r.docNumber ? `<br/><span style="font-size:10px;color:#94a3b8;">${esc(r.docNumber)}</span>` : ""}</td>
        <td>${esc(r.dueDate || "—")}</td>
        <td style="color:${r.bucketLabel === "Overdue" ? "#be123c" : "#64748b"};">${esc(r.bucketLabel)}</td>
        <td style="text-align:right;font-weight:700;">${fmt(r.amount)}</td>
      </tr>`
        )
        .join("")
    : `<tr><td colspan="4" style="text-align:center;color:#94a3b8;padding:16px;">Nothing outstanding.</td></tr>`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><title>Bills Due</title><style>${SHARED_CSS}</style></head>
<body>
  ${watermark ? `<div class="wm">TRIAL — NOT FINAL</div>` : ""}
  ${header(business, "BILLS DUE", `As at ${asAt}`)}
  <div class="meta-row">
    ${fromBlock(business, "Prepared by")}
    <div style="text-align:right;">
      <div class="meta-label">Report</div>
      <div style="font-size:20px;font-weight:800;">What to have ready</div>
    </div>
  </div>
  <table>
    <thead><tr><th>Supplier</th><th>Due</th><th>When</th><th style="text-align:right;">Amount</th></tr></thead>
    <tbody>${body}</tbody>
  </table>
  <div class="totals">
    <div class="totals-box">
      <div class="totals-row"><span>Overdue</span><span style="color:${totals.overdue > 0 ? "#be123c" : "#111"};">${fmt(totals.overdue)}</span></div>
      <div class="totals-row"><span>Within 7 days</span><span>${fmt(totals.week)}</span></div>
      <div class="totals-row"><span>Within 30 days</span><span>${fmt(totals.month)}</span></div>
      <div class="totals-row"><span>Later</span><span>${fmt(totals.later)}</span></div>
      ${totals.undated > 0 ? `<div class="totals-row"><span>No due date set</span><span>${fmt(totals.undated)}</span></div>` : ""}
      <div class="totals-row final"><span>Owed in total</span><span>${fmt(totals.total)}</span></div>
    </div>
  </div>
  <div class="footer">
    Supplier bills with a balance still owing as at ${esc(asAt)}, soonest first. Paid and credited bills are excluded — there is nothing left to plan for on them.<br/>Generated via Worklog — worklog.co.za${
      watermark ? `<br/><strong style="color:#dc2626;">Draft — made on a free Worklog trial.</strong>` : ""
    }
  </div>
</body>
</html>`;
}

// ── Contacts Reports ─────────────────────────────────────────────────────────

export type DirectoryPdfRow = { name: string; typeLabel: string; phone: string; email: string; address: string; paymentNote: string; bank: string };
export type PayerPdfRow = { name: string; behaviour: string; averageDays: number | null; paidInvoices: number; overdueCount: number; overdueAmount: number; measured: string; disagrees: boolean };
export type DormantPdfRow = { name: string; phone: string; lastSeen: string; lastSeenWhat: string; daysQuiet: number | null; never: boolean };
export type MissingPdfRow = { name: string; typeLabel: string; missing: string[]; blocking: boolean };

export function buildDirectoryHTML(
  business: BusinessProfile,
  rows: DirectoryPdfRow[],
  totals: { customers: number; suppliers: number },
  asAt: string,
  watermark = false
): string {
  const body = rows.length
    ? rows
        .map(
          (r) => `
      <tr>
        <td>${esc(r.name)}</td>
        <td>${esc(r.typeLabel)}</td>
        <td>${esc(r.phone || "—")}</td>
        <td>${esc(r.email || "—")}</td>
        <td>${esc(r.address || "—")}</td>
        <td>${esc(r.paymentNote || "—")}${r.bank ? `<br/><span style="font-size:10px;color:#94a3b8;">${esc(r.bank)}</span>` : ""}</td>
      </tr>`
        )
        .join("")
    : `<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:16px;">No contacts yet.</td></tr>`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><title>Contact Directory</title><style>${SHARED_CSS}</style></head>
<body>
  ${watermark ? `<div class="wm">TRIAL — NOT FINAL</div>` : ""}
  ${header(business, "CONTACT DIRECTORY", `As at ${asAt}`)}
  <div class="meta-row">
    ${fromBlock(business, "Prepared by")}
    <div style="text-align:right;">
      <div class="meta-label">Report</div>
      <div style="font-size:20px;font-weight:800;">Everyone you deal with</div>
    </div>
  </div>
  <table>
    <thead><tr><th>Name</th><th>Type</th><th>Phone</th><th>Email</th><th>Address</th><th>Payment</th></tr></thead>
    <tbody>${body}</tbody>
  </table>
  <div class="totals">
    <div class="totals-box">
      <div class="totals-row"><span>Customers</span><span>${totals.customers}</span></div>
      <div class="totals-row"><span>Suppliers</span><span>${totals.suppliers}</span></div>
      <div class="totals-row final"><span>Contacts</span><span>${totals.customers + totals.suppliers}</span></div>
    </div>
  </div>
  <div class="footer">
    Your contacts as at ${esc(asAt)}. Handle this list carefully — it is other people's personal information, and POPIA applies to how it is stored and shared.<br/>Generated via Worklog — worklog.co.za${
      watermark ? `<br/><strong style="color:#dc2626;">Draft — made on a free Worklog trial.</strong>` : ""
    }
  </div>
</body>
</html>`;
}

export function buildPayersHTML(
  business: BusinessProfile,
  rows: PayerPdfRow[],
  totals: { customers: number; measured: number; disagree: number; overdueAmount: number },
  asAt: string,
  watermark = false
): string {
  const body = rows.length
    ? rows
        .map(
          (r) => `
      <tr>
        <td>${esc(r.name)}</td>
        <td>${esc(r.behaviour || "—")}</td>
        <td style="text-align:center;">${r.averageDays == null ? "—" : `${r.averageDays.toFixed(0)}d`}</td>
        <td style="text-align:center;">${r.paidInvoices || "—"}</td>
        <td style="color:${r.disagrees ? "#be123c" : "#111"};">${esc(r.measured)}${r.disagrees ? " ⚠" : ""}</td>
        <td style="text-align:right;font-weight:700;color:${r.overdueAmount > 0 ? "#be123c" : "#111"};">${r.overdueAmount > 0 ? fmt(r.overdueAmount) : "—"}</td>
      </tr>`
        )
        .join("")
    : `<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:16px;">No customers yet.</td></tr>`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><title>Who Pays Late</title><style>${SHARED_CSS}</style></head>
<body>
  ${watermark ? `<div class="wm">TRIAL — NOT FINAL</div>` : ""}
  ${header(business, "WHO PAYS LATE", `As at ${asAt}`)}
  <div class="meta-row">
    ${fromBlock(business, "Prepared by")}
    <div style="text-align:right;">
      <div class="meta-label">Report</div>
      <div style="font-size:20px;font-weight:800;">What the record says, against what they do</div>
    </div>
  </div>
  <table>
    <thead><tr><th>Customer</th><th>Marked as</th><th style="text-align:center;">Avg days to pay</th><th style="text-align:center;">Paid invoices</th><th>Measured</th><th style="text-align:right;">Overdue now</th></tr></thead>
    <tbody>${body}</tbody>
  </table>
  <div class="totals">
    <div class="totals-box">
      <div class="totals-row"><span>Customers</span><span>${totals.customers}</span></div>
      <div class="totals-row"><span>With enough history to measure</span><span>${totals.measured}</span></div>
      <div class="totals-row"><span>Record disagrees with the measurement</span><span style="color:${totals.disagree > 0 ? "#be123c" : "#111"};">${totals.disagree}</span></div>
      <div class="totals-row final"><span>Overdue right now</span><span>${fmt(totals.overdueAmount)}</span></div>
    </div>
  </div>
  <div class="footer">
    Average days to pay, measured from issue date to paid date on settled invoices, as at ${esc(asAt)}. Under 30 days reads as a good payer, under 60 as slow, beyond that as a problem — the same three labels the customer form offers. A customer with no settled invoices can't be measured.<br/>Generated via Worklog — worklog.co.za${
      watermark ? `<br/><strong style="color:#dc2626;">Draft — made on a free Worklog trial.</strong>` : ""
    }
  </div>
</body>
</html>`;
}

export function buildDormantHTML(
  business: BusinessProfile,
  rows: DormantPdfRow[],
  totals: { dormant: number; never: number; customers: number },
  asAt: string,
  watermark = false,
  monthsLabel = "6 months"
): string {
  const body = rows.length
    ? rows
        .map(
          (r) => `
      <tr>
        <td>${esc(r.name)}</td>
        <td>${esc(r.phone || "—")}</td>
        <td>${r.never ? "—" : esc(r.lastSeen)}</td>
        <td>${r.never ? "never invoiced, quoted or booked" : esc(r.lastSeenWhat)}</td>
        <td style="text-align:right;font-weight:700;">${r.daysQuiet == null ? "—" : `${r.daysQuiet}d`}</td>
      </tr>`
        )
        .join("")
    : `<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:16px;">Nobody has gone quiet.</td></tr>`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><title>Dormant Customers</title><style>${SHARED_CSS}</style></head>
<body>
  ${watermark ? `<div class="wm">TRIAL — NOT FINAL</div>` : ""}
  ${header(business, "DORMANT CUSTOMERS", `Quiet ${monthsLabel}+ · as at ${asAt}`)}
  <div class="meta-row">
    ${fromBlock(business, "Prepared by")}
    <div style="text-align:right;">
      <div class="meta-label">Report</div>
      <div style="font-size:20px;font-weight:800;">Who to call</div>
    </div>
  </div>
  <table>
    <thead><tr><th>Customer</th><th>Phone</th><th>Last seen</th><th>What</th><th style="text-align:right;">Quiet for</th></tr></thead>
    <tbody>${body}</tbody>
  </table>
  <div class="totals">
    <div class="totals-box">
      <div class="totals-row"><span>Customers in total</span><span>${totals.customers}</span></div>
      <div class="totals-row"><span>Never invoiced, quoted or booked</span><span>${totals.never}</span></div>
      <div class="totals-row final"><span>Gone quiet</span><span>${totals.dormant}</span></div>
    </div>
  </div>
  <div class="footer">
    Customers with no invoice, quote or appointment in ${esc(monthsLabel)}, as at ${esc(asAt)}, longest quiet first.<br/>Generated via Worklog — worklog.co.za${
      watermark ? `<br/><strong style="color:#dc2626;">Draft — made on a free Worklog trial.</strong>` : ""
    }
  </div>
</body>
</html>`;
}

export function buildMissingDetailsHTML(
  business: BusinessProfile,
  rows: MissingPdfRow[],
  totals: { contacts: number; incomplete: number; blocking: number },
  asAt: string,
  watermark = false
): string {
  const body = rows.length
    ? rows
        .map(
          (r) => `
      <tr>
        <td>${esc(r.name)}${r.blocking ? ` <span style="color:#be123c;font-weight:700;">⚠</span>` : ""}</td>
        <td>${esc(r.typeLabel)}</td>
        <td>${esc(r.missing.join(", "))}</td>
      </tr>`
        )
        .join("")
    : `<tr><td colspan="3" style="text-align:center;color:#94a3b8;padding:16px;">Every contact is complete.</td></tr>`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><title>Missing Details</title><style>${SHARED_CSS}</style></head>
<body>
  ${watermark ? `<div class="wm">TRIAL — NOT FINAL</div>` : ""}
  ${header(business, "MISSING DETAILS", `As at ${asAt}`)}
  <div class="meta-row">
    ${fromBlock(business, "Prepared by")}
    <div style="text-align:right;">
      <div class="meta-label">Report</div>
      <div style="font-size:20px;font-weight:800;">Records too thin to work with</div>
    </div>
  </div>
  <table>
    <thead><tr><th>Contact</th><th>Type</th><th>Missing</th></tr></thead>
    <tbody>${body}</tbody>
  </table>
  <div class="totals">
    <div class="totals-box">
      <div class="totals-row"><span>Contacts</span><span>${totals.contacts}</span></div>
      <div class="totals-row"><span>Missing something</span><span>${totals.incomplete}</span></div>
      <div class="totals-row final"><span>Blocking a document</span><span>${totals.blocking}</span></div>
    </div>
  </div>
  <div class="footer">
    Contacts with details missing as at ${esc(asAt)}. The ⚠ ones block something concrete: no email means no statement or remittance can be sent, and a supplier with no banking details can't be paid off a remittance.<br/>Generated via Worklog — worklog.co.za${
      watermark ? `<br/><strong style="color:#dc2626;">Draft — made on a free Worklog trial.</strong>` : ""
    }
  </div>
</body>
</html>`;
}

// ── EMP201 ───────────────────────────────────────────────────────────────────
// The monthly PAYE/UIF/SDL declaration, as a printable working. Like the payslip
// it's an internal aid, not the SARS submission — the footer says so — but it's
// the number the business hands its accountant, so it gets a real document.
export type Emp201PdfRun = { workerName: string; payDate: string; gross: number; paye: number; uif: number };
export type Emp201PdfData = {
  periodLabel: string;
  dueDate: string;
  employeesPaid: number;
  paye: number;
  uifEmployee: number;
  uifEmployer: number;
  sdl: number;
  eti: number;
  totalDue: number;
  payeRef: string;
  runs: Emp201PdfRun[];
};

export function buildEmp201HTML(business: BusinessProfile, data: Emp201PdfData, asAt: string, watermark = false): string {
  const body = data.runs.length
    ? data.runs
        .map(
          (r) => `
      <tr>
        <td>${esc(r.workerName)}</td>
        <td>${esc(r.payDate)}</td>
        <td style="text-align:right;">${fmt(r.gross)}</td>
        <td style="text-align:right;">${fmt(r.paye)}</td>
        <td style="text-align:right;">${fmt(r.uif)}</td>
      </tr>`
        )
        .join("")
    : `<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:16px;">No pay runs recorded for this month.</td></tr>`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><title>EMP201</title><style>${SHARED_CSS}</style></head>
<body>
  ${watermark ? `<div class="wm">TRIAL — NOT FINAL</div>` : ""}
  ${header(business, "EMP201", `${esc(data.periodLabel)} · as at ${asAt}`)}
  <div class="meta-row">
    ${fromBlock(business, "Employer")}
    <div style="text-align:right;">
      <div class="meta-label">Declaration period</div>
      <div style="font-size:20px;font-weight:800;">${esc(data.periodLabel)}</div>
      <div style="font-size:12px;color:#64748b;margin-top:2px;">${data.employeesPaid} employee${data.employeesPaid !== 1 ? "s" : ""} paid · due ${esc(data.dueDate)}</div>
      ${data.payeRef ? `<div class="vat-note" style="margin-top:6px;">PAYE Ref: ${esc(data.payeRef)}</div>` : ""}
    </div>
  </div>
  <table>
    <thead>
      <tr><th>Employee</th><th>Pay date</th><th style="text-align:right;">Gross</th><th style="text-align:right;">PAYE</th><th style="text-align:right;">UIF</th></tr>
    </thead>
    <tbody>${body}</tbody>
  </table>
  <div class="totals">
    <div class="totals-box">
      <div class="totals-row"><span>PAYE (employee tax)</span><span>${fmt(data.paye)}</span></div>
      <div class="totals-row"><span>UIF — employee (1%)</span><span>${fmt(data.uifEmployee)}</span></div>
      <div class="totals-row"><span>UIF — employer (1%)</span><span>${fmt(data.uifEmployer)}</span></div>
      ${data.sdl > 0 ? `<div class="totals-row"><span>SDL (1%)</span><span>${fmt(data.sdl)}</span></div>` : ""}
      ${data.eti > 0 ? `<div class="totals-row"><span>Less: ETI claimed</span><span>−${fmt(data.eti)}</span></div>` : ""}
      <div class="totals-row final"><span>Total due to SARS</span><span>${fmt(data.totalDue)}</span></div>
    </div>
  </div>
  <div class="footer">
    EMP201 working for ${esc(data.periodLabel)}, as at ${esc(asAt)}. Submit the actual EMP201 via SARS eFiling and declare UIF separately on uFiling — this is a calculation aid, not a filing. Penalty: 10% of PAYE if late.<br/>Generated via Worklog — worklog.co.za${
      watermark ? `<br/><strong style="color:#dc2626;">Draft — made on a free Worklog trial.</strong>` : ""
    }
  </div>
</body>
</html>`;
}

// ── VAT201 ───────────────────────────────────────────────────────────────────
export type Vat201PdfData = {
  periodLabel: string;
  vatPeriod: string;
  standardTurnover: number;
  zeroRatedTurnover: number;
  exemptTurnover: number;
  totalTurnover: number;
  outputVAT: number;
  custCreditVat: number;
  inputVAT: number;
  suppCreditVat: number;
  vatDue: number; // + = payable, − = refund
};

export function buildVat201HTML(business: BusinessProfile, data: Vat201PdfData, asAt: string, watermark = false): string {
  const payable = data.vatDue >= 0;
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><title>VAT201</title><style>${SHARED_CSS}</style></head>
<body>
  ${watermark ? `<div class="wm">TRIAL — NOT FINAL</div>` : ""}
  ${header(business, "VAT201", `${esc(data.periodLabel)} · as at ${asAt}`)}
  <div class="meta-row">
    ${fromBlock(business, "Vendor")}
    <div style="text-align:right;">
      <div class="meta-label">Tax period</div>
      <div style="font-size:20px;font-weight:800;">${esc(data.periodLabel)}</div>
      <div style="font-size:12px;color:#64748b;margin-top:2px;">${esc(data.vatPeriod)}</div>
    </div>
  </div>
  <table>
    <thead><tr><th>Supplies this period (excl. VAT)</th><th style="text-align:right;">Value</th></tr></thead>
    <tbody>
      <tr><td>Standard-rated (15%)</td><td style="text-align:right;">${fmt(data.standardTurnover)}</td></tr>
      <tr><td>Zero-rated (0%)</td><td style="text-align:right;">${fmt(data.zeroRatedTurnover)}</td></tr>
      <tr><td>Exempt</td><td style="text-align:right;">${fmt(data.exemptTurnover)}</td></tr>
      <tr><td style="font-weight:700;">Total turnover</td><td style="text-align:right;font-weight:700;">${fmt(data.totalTurnover)}</td></tr>
    </tbody>
  </table>
  <div class="totals">
    <div class="totals-box">
      <div class="totals-row"><span>Output VAT (on sales)</span><span>${fmt(data.outputVAT)}</span></div>
      ${data.custCreditVat > 0 ? `<div class="totals-row"><span>Less credit notes</span><span>−${fmt(data.custCreditVat)}</span></div>` : ""}
      <div class="totals-row"><span>Input VAT (on purchases)</span><span>−${fmt(data.inputVAT)}</span></div>
      ${data.suppCreditVat > 0 ? `<div class="totals-row"><span>Less credit notes</span><span>−${fmt(data.suppCreditVat)}</span></div>` : ""}
      <div class="totals-row final"><span>${payable ? "VAT payable" : "VAT refund due"}</span><span>${fmt(Math.abs(data.vatDue))}</span></div>
    </div>
  </div>
  <div class="footer">
    VAT201 working for ${esc(data.periodLabel)}, as at ${esc(asAt)}. Only standard-rated supplies produce output VAT. Submit the actual return via SARS eFiling — this is a calculation aid, not a filing. Due by the 25th of the month after the period ends.<br/>Generated via Worklog — worklog.co.za${
      watermark ? `<br/><strong style="color:#dc2626;">Draft — made on a free Worklog trial.</strong>` : ""
    }
  </div>
</body>
</html>`;
}

// ── UIF declaration (monthly) ────────────────────────────────────────────────
export type Uif201PdfRow = { workerName: string; payDate: string; gross: number; uifEmployee: number; uifEmployer: number };
export type Uif201PdfData = {
  periodLabel: string;
  dueDate: string;
  employeesPaid: number;
  uifEmployee: number;
  uifEmployer: number;
  total: number;
  uifRef: string;
  rows: Uif201PdfRow[];
};

export function buildUif201HTML(business: BusinessProfile, data: Uif201PdfData, asAt: string, watermark = false): string {
  const body = data.rows.length
    ? data.rows
        .map(
          (r) => `
      <tr>
        <td>${esc(r.workerName)}</td>
        <td>${esc(r.payDate)}</td>
        <td style="text-align:right;">${fmt(r.gross)}</td>
        <td style="text-align:right;">${fmt(r.uifEmployee)}</td>
        <td style="text-align:right;">${fmt(r.uifEmployer)}</td>
      </tr>`
        )
        .join("")
    : `<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:16px;">No pay runs recorded for this month.</td></tr>`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><title>UIF declaration</title><style>${SHARED_CSS}</style></head>
<body>
  ${watermark ? `<div class="wm">TRIAL — NOT FINAL</div>` : ""}
  ${header(business, "UIF DECLARATION", `${esc(data.periodLabel)} · as at ${asAt}`)}
  <div class="meta-row">
    ${fromBlock(business, "Employer")}
    <div style="text-align:right;">
      <div class="meta-label">Declaration period</div>
      <div style="font-size:20px;font-weight:800;">${esc(data.periodLabel)}</div>
      <div style="font-size:12px;color:#64748b;margin-top:2px;">${data.employeesPaid} employee${data.employeesPaid !== 1 ? "s" : ""} · due ${esc(data.dueDate)}</div>
      ${data.uifRef ? `<div class="vat-note" style="margin-top:6px;">Ref: ${esc(data.uifRef)}</div>` : ""}
    </div>
  </div>
  <table>
    <thead>
      <tr><th>Employee</th><th>Pay date</th><th style="text-align:right;">Gross</th><th style="text-align:right;">UIF employee</th><th style="text-align:right;">UIF employer</th></tr>
    </thead>
    <tbody>${body}</tbody>
  </table>
  <div class="totals">
    <div class="totals-box">
      <div class="totals-row"><span>UIF — employee (1%)</span><span>${fmt(data.uifEmployee)}</span></div>
      <div class="totals-row"><span>UIF — employer (1%)</span><span>${fmt(data.uifEmployer)}</span></div>
      <div class="totals-row final"><span>Total UIF</span><span>${fmt(data.total)}</span></div>
    </div>
  </div>
  <div class="footer">
    Monthly UIF declaration for ${esc(data.periodLabel)}, as at ${esc(asAt)}. Declare on uFiling (Department of Employment &amp; Labour) — this is a calculation aid, not a filing. Submit a UI-19 whenever someone joins or leaves.<br/>Generated via Worklog — worklog.co.za${
      watermark ? `<br/><strong style="color:#dc2626;">Draft — made on a free Worklog trial.</strong>` : ""
    }
  </div>
</body>
</html>`;
}

// ── COIDA — annual Return of Earnings ────────────────────────────────────────
export type CoidaPdfRow = { workerName: string; earnings: number };
export type CoidaPdfData = {
  yearLabel: string;
  employees: number;
  totalEarnings: number;
  rows: CoidaPdfRow[];
};

export function buildCoidaHTML(business: BusinessProfile, data: CoidaPdfData, asAt: string, watermark = false): string {
  const body = data.rows.length
    ? data.rows
        .map(
          (r) => `
      <tr>
        <td>${esc(r.workerName)}</td>
        <td style="text-align:right;">${fmt(r.earnings)}</td>
      </tr>`
        )
        .join("")
    : `<tr><td colspan="2" style="text-align:center;color:#94a3b8;padding:16px;">No wages recorded for this year.</td></tr>`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><title>COIDA Return of Earnings</title><style>${SHARED_CSS}</style></head>
<body>
  ${watermark ? `<div class="wm">TRIAL — NOT FINAL</div>` : ""}
  ${header(business, "RETURN OF EARNINGS", `${esc(data.yearLabel)} · as at ${asAt}`)}
  <div class="meta-row">
    ${fromBlock(business, "Employer")}
    <div style="text-align:right;">
      <div class="meta-label">Assessment year</div>
      <div style="font-size:20px;font-weight:800;">${esc(data.yearLabel)}</div>
      <div style="font-size:12px;color:#64748b;margin-top:2px;">${data.employees} employee${data.employees !== 1 ? "s" : ""}</div>
    </div>
  </div>
  <table>
    <thead><tr><th>Employee</th><th style="text-align:right;">Earnings (year)</th></tr></thead>
    <tbody>${body}</tbody>
  </table>
  <div class="totals">
    <div class="totals-box">
      <div class="totals-row final"><span>Total earnings</span><span>${fmt(data.totalEarnings)}</span></div>
    </div>
  </div>
  <div class="footer">
    COIDA Return of Earnings for ${esc(data.yearLabel)}, as at ${esc(asAt)}. File on CompEasy — this is a calculation aid, not a filing. Each employee's earnings are capped at the annual OID threshold for the ROE; this shows uncapped totals, so confirm the cap with your accountant before submitting.<br/>Generated via Worklog — worklog.co.za${
      watermark ? `<br/><strong style="color:#dc2626;">Draft — made on a free Worklog trial.</strong>` : ""
    }
  </div>
</body>
</html>`;
}

// ── EMP501 reconciliation ────────────────────────────────────────────────────
// Reconciles what the pay runs add up to against what was declared on the
// EMP201s marked filed. It never generates IRP5/IT3(a) certificates — that
// (source codes, directives) is out of scope and stays on e@syFile.
export type Emp501PdfRow = { month: string; declared: number | null; calculated: number };
export type Emp501PdfData = {
  periodLabel: string;
  paye: number;
  uif: number;
  sdl: number;
  eti: number;
  totalCalculated: number;
  totalDeclared: number;
  difference: number;
  rows: Emp501PdfRow[];
};

export function buildEmp501HTML(business: BusinessProfile, data: Emp501PdfData, asAt: string, watermark = false): string {
  const body = data.rows.length
    ? data.rows
        .map((r) => {
          const diff = r.declared == null ? null : r.calculated - r.declared;
          return `
      <tr>
        <td>${esc(r.month)}</td>
        <td style="text-align:right;">${fmt(r.calculated)}</td>
        <td style="text-align:right;">${r.declared == null ? `<span style="color:#b45309;">not filed</span>` : fmt(r.declared)}</td>
        <td style="text-align:right;color:${diff && Math.abs(diff) >= 0.5 ? "#be123c" : "#94a3b8"};">${diff == null ? "—" : fmt(diff)}</td>
      </tr>`;
        })
        .join("")
    : `<tr><td colspan="4" style="text-align:center;color:#94a3b8;padding:16px;">No pay runs in this period.</td></tr>`;

  const reconciled = Math.abs(data.difference) < 0.5;
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><title>EMP501 reconciliation</title><style>${SHARED_CSS}</style></head>
<body>
  ${watermark ? `<div class="wm">TRIAL — NOT FINAL</div>` : ""}
  ${header(business, "EMP501 RECONCILIATION", `${esc(data.periodLabel)} · as at ${asAt}`)}
  <div class="meta-row">
    ${fromBlock(business, "Employer")}
    <div style="text-align:right;">
      <div class="meta-label">Reconciliation period</div>
      <div style="font-size:20px;font-weight:800;">${esc(data.periodLabel)}</div>
    </div>
  </div>
  <table>
    <thead>
      <tr><th>Month</th><th style="text-align:right;">Per pay runs</th><th style="text-align:right;">Declared (EMP201)</th><th style="text-align:right;">Difference</th></tr>
    </thead>
    <tbody>${body}</tbody>
  </table>
  <div class="totals">
    <div class="totals-box">
      <div class="totals-row"><span>PAYE (per pay runs)</span><span>${fmt(data.paye)}</span></div>
      <div class="totals-row"><span>UIF (per pay runs)</span><span>${fmt(data.uif)}</span></div>
      ${data.sdl > 0 ? `<div class="totals-row"><span>SDL (per pay runs)</span><span>${fmt(data.sdl)}</span></div>` : ""}
      ${data.eti > 0 ? `<div class="totals-row"><span>Less: ETI</span><span>−${fmt(data.eti)}</span></div>` : ""}
      <div class="totals-row"><span>Total per pay runs</span><span>${fmt(data.totalCalculated)}</span></div>
      <div class="totals-row"><span>Total declared (EMP201s filed)</span><span>${fmt(data.totalDeclared)}</span></div>
      <div class="totals-row final"><span>${reconciled ? "Reconciled" : "Difference to resolve"}</span><span>${fmt(data.difference)}</span></div>
    </div>
  </div>
  <div class="footer">
    EMP501 reconciliation for ${esc(data.periodLabel)}, as at ${esc(asAt)}. This reconciles pay-run totals against the EMP201s you marked filed; it does not generate IRP5/IT3(a) certificates. File the EMP501 and issue certificates on SARS e@syFile.<br/>Generated via Worklog — worklog.co.za${
      watermark ? `<br/><strong style="color:#dc2626;">Draft — made on a free Worklog trial.</strong>` : ""
    }
  </div>
</body>
</html>`;
}
