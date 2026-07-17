// Customer statements and supplier remittance advices are ledgers of whole
// documents, not line-item documents — the debit/credit/status columns don't
// map onto buildDocumentHTML's subtotal/VAT/deposit shape, so they get their
// own builder (matching the source prototype, which did the same).
import { fmt } from "@/lib/format";
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
`;

function header(business: BusinessProfile, title: string, dateLabel: string) {
  return `
  <div class="header">
    <div class="brand">
      <div class="brand-mark">W</div>
      <div>
        <div class="brand-name">WORKLOG</div>
        <div style="font-size:10px;color:#94a3b8;">worklog.co.za</div>
      </div>
    </div>
    <div>
      <div class="doc-title">${title}</div>
      <div class="doc-date">${dateLabel}</div>
    </div>
  </div>`;
}

function fromBlock(business: BusinessProfile, label: string) {
  return `
    <div>
      <div class="meta-label">${label}</div>
      <div class="meta-value">
        <strong>${business.name || "Your Business"}</strong><br/>
        ${business.address ? business.address + "<br/>" : ""}
        ${business.phone ? business.phone + "<br/>" : ""}
        ${business.email ?? ""}
      </div>
      ${business.vat_number ? `<div class="vat-note">VAT Reg No: ${business.vat_number}</div>` : ""}
    </div>`;
}

export type StatementLine = {
  date: string;
  reference: string;
  amount: number;
  balance: number;
  paid: boolean;
};

export function buildStatementHTML(
  business: BusinessProfile,
  clientName: string,
  lines: StatementLine[],
  totals: { invoiced: number; received: number; outstanding: number },
  asAt: string
): string {
  const rows = lines
    .map(
      (l) => `
      <tr>
        <td>${l.date}</td>
        <td>${l.reference}</td>
        <td>Invoice issued</td>
        <td style="text-align:right;">${fmt(l.amount)}</td>
        <td style="text-align:right;color:${l.paid ? "#0369A1" : "#b45309"};">${l.paid ? "✓ Paid" : fmt(l.balance) + " due"}</td>
      </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><title>Statement — ${clientName}</title><style>${SHARED_CSS}</style></head>
<body>
  ${header(business, "ACCOUNT STATEMENT", `As at ${asAt}`)}
  <div class="meta-row">
    ${fromBlock(business, "From")}
    <div style="text-align:right;">
      <div class="meta-label">Statement For</div>
      <div style="font-size:20px;font-weight:800;">${clientName}</div>
    </div>
  </div>
  <table>
    <thead>
      <tr><th>Date</th><th>Reference</th><th>Description</th><th style="text-align:right;">Amount</th><th style="text-align:right;">Status</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="totals">
    <div class="totals-box">
      <div class="totals-row"><span>Total invoiced</span><span>${fmt(totals.invoiced)}</span></div>
      <div class="totals-row"><span>Total received</span><span>${fmt(totals.received)}</span></div>
      <div class="totals-row final"><span>Balance outstanding</span><span>${fmt(totals.outstanding)}</span></div>
    </div>
  </div>
  <div class="footer">
    Please contact us if you have any queries regarding this statement.<br/>Generated via WORKLOG — worklog.co.za
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

export function buildRemittanceHTML(
  business: BusinessProfile,
  supplierName: string,
  lines: RemittanceLine[],
  payment: { method: string; date: string; reference: string; total: number }
): string {
  const rows = lines
    .map(
      (l) => `
      <tr>
        <td>${l.date}</td>
        <td>${l.reference}</td>
        <td style="text-align:right;">${fmt(l.invoiceAmount)}</td>
        <td style="text-align:right;font-weight:700;color:#0C4A6E;">${fmt(l.amountPaying)}</td>
      </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><title>Remittance Advice — ${supplierName}</title><style>${SHARED_CSS}</style></head>
<body>
  ${header(business, "REMITTANCE ADVICE", payment.date)}
  <div class="meta-row">
    ${fromBlock(business, "Payment From")}
    <div style="text-align:right;">
      <div class="meta-label">Payment To</div>
      <div style="font-size:20px;font-weight:800;">${supplierName}</div>
    </div>
  </div>
  <div style="background:#fff7ed;border-radius:12px;padding:16px 20px;margin-bottom:24px;display:flex;justify-content:space-between;align-items:center;">
    <div>
      <div style="font-size:11px;color:#b45309;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:4px;">Payment method</div>
      <div style="font-size:15px;font-weight:700;">${payment.method}</div>
      ${payment.reference ? `<div style="font-size:12px;color:#64748b;margin-top:2px;">Ref: ${payment.reference}</div>` : ""}
    </div>
    <div style="text-align:right;">
      <div style="font-size:11px;color:#b45309;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:4px;">Payment date</div>
      <div style="font-size:15px;font-weight:700;">${payment.date}</div>
    </div>
  </div>
  <div style="font-size:11px;font-weight:700;color:#b45309;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:10px;">Invoices being settled</div>
  <table>
    <thead>
      <tr><th>Invoice date</th><th>Your ref</th><th style="text-align:right;">Invoice amount</th><th style="text-align:right;">Amount paying</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="totals">
    <div class="totals-box">
      <div class="totals-row final"><span>Total payment</span><span>${fmt(payment.total)}</span></div>
    </div>
  </div>
  <div class="footer">
    Please apply this payment to the invoices listed above. Contact us if you have any queries.<br/>Generated via WORKLOG — worklog.co.za
  </div>
</body>
</html>`;
}
