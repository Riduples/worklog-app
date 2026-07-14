// Ported from the prototype's buildDocumentHTML, with two deliberate changes:
// 1. VAT is computed from the document's own saved vat_rate/vat_amount snapshot
//    (never a hardcoded 15% — the source prototype's known inconsistency bug).
// 2. Data comes from the production schema's column names (client_name,
//    total_amount, line_items, ...) instead of the prototype's local state shape.
import { fmt, todayStr } from "@/lib/format";
import type { BusinessProfile } from "@/lib/supabase/hooks/useBusinessProfile";

export type DocKind = "quote" | "invoice" | "purchaseorder" | "payslip";

export type DocForRender = {
  doc_number: string;
  issue_date: string;
  recipient_name: string;
  line_items: Array<{ desc?: string; qty?: number; labour?: number; materials?: number; unit_price?: number }>;
  subtotal: number;
  vat_rate: number | null;
  vat_amount: number;
  deposit: number;
  balance_due?: number | null;
  due_date?: string | null;
  valid_until?: string | null;
  requested_delivery?: string | null;
};

export function buildDocumentHTML(doc: DocForRender, business: BusinessProfile, kind: DocKind): string {
  const isInvoice = kind === "invoice";
  const isPO = kind === "purchaseorder";
  const isPayslip = kind === "payslip";
  const hasVat = !isPayslip && !!business.vat_number && doc.vat_rate != null;
  const docTitle = isPayslip ? "PAYSLIP" : isPO ? "PURCHASE ORDER" : isInvoice ? (business.vat_number ? "TAX INVOICE" : "INVOICE") : "QUOTE";
  const recipientLabel = isPayslip ? "Employee" : isPO ? "To (Supplier)" : isInvoice ? "Bill To" : "Quote For";

  const rows = doc.line_items
    .map((i) => {
      const lineTotal = isPO
        ? Number(i.qty || 1) * Number(i.unit_price || 0)
        : Number(i.labour || 0) + Number(i.materials || 0);
      return `
      <tr>
        <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#111;">${i.desc || "Item"}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#374151;text-align:center;">${i.qty || 1}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#374151;text-align:right;">${fmt(lineTotal)}</td>
      </tr>`;
    })
    .join("");

  const vatPctLabel = hasVat ? `${((doc.vat_rate as number) * 100).toFixed(0)}%` : "";
  const totalInclVat = doc.subtotal + (hasVat ? doc.vat_amount : 0);
  const finalDue = isInvoice
    ? (doc.balance_due != null ? Number(doc.balance_due) : doc.subtotal) + (hasVat ? doc.vat_amount : 0)
    : totalInclVat;

  const totalsRows = [
    hasVat
      ? `<div class="totals-row"><span>Subtotal (excl. VAT)</span><span>${fmt(doc.subtotal)}</span></div>
         <div class="totals-row"><span>VAT (${vatPctLabel})</span><span>${fmt(doc.vat_amount)}</span></div>`
      : "",
    doc.deposit > 0
      ? `<div class="totals-row"><span>${hasVat ? "Total incl. VAT" : "Subtotal"}</span><span>${fmt(totalInclVat)}</span></div>
         <div class="totals-row"><span>Deposit ${isInvoice ? "received" : "required"}</span><span>−${fmt(doc.deposit)}</span></div>`
      : "",
    `<div class="totals-row final">
       <span>${isPayslip ? "NET PAY" : isInvoice ? (doc.deposit > 0 ? "Balance Due" : "Total Due") : "Total"}${hasVat ? " (incl. VAT)" : ""}</span>
       <span>${fmt(finalDue)}</span>
     </div>`,
  ].join("");

  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>${docTitle} ${doc.doc_number}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; background: #fff; color: #111; padding: 40px; width: 700px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #1B4332; padding-bottom: 20px; margin-bottom: 28px; }
  .brand { display: flex; align-items: center; gap: 10px; }
  .brand-mark { background: #F59E0B; border-radius: 8px; width: 36px; height: 36px; display:flex; align-items:center; justify-content:center; font-weight: 900; font-size: 18px; color: #1B4332; font-family: monospace; }
  .brand-name { font-size: 13px; font-weight: 900; color: #1B4332; letter-spacing: 1.5px; }
  .doc-title { font-size: 26px; font-weight: 800; color: #1B4332; text-align: right; }
  .doc-number { font-size: 12px; color: #64748b; text-align: right; margin-top: 4px; }
  .meta-row { display: flex; justify-content: space-between; margin-bottom: 28px; gap: 24px; }
  .meta-block { flex: 1; }
  .meta-label { font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 6px; }
  .meta-value { font-size: 13px; color: #111; line-height: 1.5; }
  .meta-value strong { font-weight: 700; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  thead th { background: #f0fdf4; padding: 10px 8px; font-size: 11px; font-weight: 700; color: #1B4332; text-transform: uppercase; letter-spacing: 0.5px; text-align: left; }
  thead th:nth-child(2) { text-align: center; }
  thead th:nth-child(3) { text-align: right; }
  .totals { display: flex; justify-content: flex-end; }
  .totals-box { width: 280px; }
  .totals-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 13px; color: #374151; }
  .totals-row.final { border-top: 2px solid #1B4332; margin-top: 6px; padding-top: 12px; font-size: 18px; font-weight: 800; color: #1B4332; }
  .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #94a3b8; line-height: 1.6; }
  .vat-note { font-size: 10px; color: #94a3b8; margin-top: 4px; }
</style>
</head>
<body>
  <div class="header">
    <div class="brand">
      <div class="brand-mark">W</div>
      <div>
        <div class="brand-name">WORKLOG</div>
        <div style="font-size:10px;color:#94a3b8;">worklog.co.za</div>
      </div>
    </div>
    <div>
      <div class="doc-title">${docTitle}</div>
      <div class="doc-number">${doc.doc_number} &nbsp;·&nbsp; ${doc.issue_date || todayStr()}</div>
    </div>
  </div>

  <div class="meta-row">
    <div class="meta-block">
      <div class="meta-label">From</div>
      <div class="meta-value">
        <strong>${business.name || "Your Business Name"}</strong><br/>
        ${business.address ? business.address + "<br/>" : ""}
        ${business.phone ? business.phone + "<br/>" : ""}
        ${business.email ? business.email : ""}
      </div>
      ${business.vat_number ? `<div class="vat-note">VAT Reg No: ${business.vat_number}</div>` : ""}
    </div>
    <div class="meta-block">
      <div class="meta-label">${recipientLabel}</div>
      <div class="meta-value">
        <strong>${doc.recipient_name}</strong>
      </div>
      ${isInvoice && doc.due_date ? `<div class="vat-note" style="margin-top:8px;"><strong>Due date:</strong> ${doc.due_date}</div>` : ""}
      ${isPO && doc.requested_delivery ? `<div class="vat-note" style="margin-top:8px;"><strong>Requested delivery:</strong> ${doc.requested_delivery}</div>` : ""}
      ${!isInvoice && !isPO && !isPayslip && doc.valid_until ? `<div class="vat-note" style="margin-top:8px;">Valid until ${doc.valid_until}</div>` : ""}
      ${isPayslip && doc.due_date ? `<div class="vat-note" style="margin-top:8px;"><strong>Pay date:</strong> ${doc.due_date}</div>` : ""}
    </div>
  </div>

  <table>
    <thead>
      <tr><th>Description</th><th>Qty</th><th>Amount</th></tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>

  <div class="totals">
    <div class="totals-box">
      ${totalsRows}
    </div>
  </div>

  <div class="footer">
    ${
      isPayslip
        ? "This is a computer-generated payslip. Retain it for your records."
        : isPO
          ? "This purchase order is subject to the terms agreed with the supplier."
          : isInvoice
            ? "Please make payment by the due date above. Thank you for your business."
            : `This quote is valid until ${doc.valid_until || "30 days from the issue date"}. Reply to accept or for any questions.`
    }
    <br/>Generated via WORKLOG — worklog.co.za
  </div>
</body>
</html>`;
}
