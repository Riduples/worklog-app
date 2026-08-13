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

export function buildTravelReportHTML(
  business: BusinessProfile,
  rows: TravelReportRow[],
  totals: { trips: number; km: number; deduction: number },
  asAt: string,
  watermark = false,
  periodLabel?: string
): string {
  const detailRows = rows.length
    ? rows
        .map(
          (r) => `
      <tr>
        <td>${esc(r.date)}</td>
        <td>${esc(r.type)}</td>
        <td>${esc(r.purpose || "—")}</td>
        <td style="text-align:right;">${r.odoStart.toFixed(0)}</td>
        <td style="text-align:right;">${r.odoEnd.toFixed(0)}</td>
        <td style="text-align:right;">${r.km.toFixed(1)} km</td>
        <td style="text-align:right;font-weight:700;">${fmt(r.deduction)}</td>
      </tr>`
        )
        .join("")
    : `<tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:16px;">No trips logged.</td></tr>`;

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
  <div style="font-size:11px;font-weight:700;color:#0C4A6E;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:10px;">Trips</div>
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
