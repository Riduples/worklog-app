// Ported from the prototype's buildDocumentHTML, with two deliberate changes:
// 1. VAT is computed from the document's own saved vat_rate/vat_amount snapshot
//    (never a hardcoded 15% — the source prototype's known inconsistency bug).
// 2. Data comes from the production schema's column names (client_name,
//    total_amount, line_items, ...) instead of the prototype's local state shape.
import { fmt, todayStr } from "@/lib/format";
import { esc } from "@/lib/docgen/esc";
import { balanceInclVat } from "@/lib/balance";
import { salesLineTotal } from "@/lib/lineItems";
import type { BusinessProfile } from "@/lib/supabase/hooks/useBusinessProfile";

export type DocKind = "quote" | "invoice" | "purchaseorder" | "payslip" | "creditnote";

export type DocForRender = {
  doc_number: string;
  issue_date: string;
  recipient_name: string;
  recipient_address?: string | null;
  line_items: Array<{ desc?: string; qty?: number; labour?: number; materials?: number; unit_price?: number }>;
  subtotal: number;
  vat_rate: number | null;
  vat_amount: number;
  deposit: number;
  balance_due?: number | null;
  due_date?: string | null;
  valid_until?: string | null;
  requested_delivery?: string | null;
  reference_doc_number?: string | null;
  reason?: string | null;
  terms?: string | null;
  /**
   * Payslip only: the run's own working — the period it covers, how the days
   * were arrived at, the leave that moved them, what's left on their advance.
   * A payslip that only lists amounts leaves the employee (and the owner, a
   * month later) with no way to check any of it.
   */
  payslip_meta?: Array<{ label: string; value: string }> | null;
};


export function buildDocumentHTML(doc: DocForRender, business: BusinessProfile, kind: DocKind, watermark = false): string {
  const isInvoice = kind === "invoice";
  const isPO = kind === "purchaseorder";
  const isPayslip = kind === "payslip";
  const isCreditNote = kind === "creditnote";
  // VAT is driven by the document's own vat_rate/vat_amount snapshot, NOT the live
  // business.vat_number. The number is a freely-editable profile field; clearing it
  // after issuing an invoice must not silently drop VAT from the PDF total while the
  // on-screen modal and WhatsApp text (which add the stored vat_amount) still show
  // the VAT-inclusive figure. The snapshot is the source of truth for what was billed.
  const hasVat = !isPayslip && doc.vat_rate != null && doc.vat_amount > 0;
  const docTitle = isCreditNote ? "CREDIT NOTE" : isPayslip ? "PAYSLIP" : isPO ? "PURCHASE ORDER" : isInvoice ? (hasVat ? "TAX INVOICE" : "INVOICE") : "QUOTE";
  const recipientLabel = isCreditNote ? "Credit To" : isPayslip ? "Employee" : isPO ? "To (Supplier)" : isInvoice ? "Bill To" : "Quote For";

  const rows = doc.line_items
    .map((i) => {
      // Presence-based: PO + new sales lines carry unit_price (qty × unit_price);
      // historic sales lines fall back to labour + materials. One helper covers all.
      const lineTotal = salesLineTotal(i);
      return `
      <tr>
        <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#111;">${esc(i.desc || "Item")}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#374151;text-align:center;">${esc(i.qty || 1)}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#374151;text-align:right;">${fmt(lineTotal)}</td>
      </tr>`;
    })
    .join("");

  const vatPctLabel = hasVat ? `${((doc.vat_rate as number) * 100).toFixed(0)}%` : "";
  const totalInclVat = doc.subtotal + (hasVat ? doc.vat_amount : 0);
  // An invoice with no balance_due recorded hasn't been part-paid, so the whole
  // subtotal is still due — that fallback stays. What changed is the guard: a
  // PAID invoice has balance_due 0 and keeps its vat_amount, so the old sum
  // printed "Total Due (incl. VAT): R150.00" on the PDF of a settled invoice.
  const finalDue = isInvoice
    ? balanceInclVat(doc.balance_due != null ? doc.balance_due : doc.subtotal, hasVat ? doc.vat_amount : 0)
    : totalInclVat;

  const totalsRows = [
    hasVat
      ? `<div class="totals-row"><span>Subtotal (excl. VAT)</span><span>${fmt(doc.subtotal)}</span></div>
         <div class="totals-row"><span>VAT (${vatPctLabel})</span><span>${fmt(doc.vat_amount)}</span></div>`
      : "",
    !isCreditNote && doc.deposit > 0
      ? `<div class="totals-row"><span>${hasVat ? "Total incl. VAT" : "Subtotal"}</span><span>${fmt(totalInclVat)}</span></div>
         <div class="totals-row"><span>Deposit ${isInvoice ? "received" : "required"}</span><span>−${fmt(doc.deposit)}</span></div>`
      : "",
    `<div class="totals-row final">
       <span>${isCreditNote ? "Total credit" : isPayslip ? "NET PAY" : isInvoice ? (doc.deposit > 0 ? "Balance Due" : "Total Due") : "Total"}${hasVat ? " (incl. VAT)" : ""}</span>
       <span>${fmt(finalDue)}</span>
     </div>`,
  ].join("");

  // Ported from worklog-v65.jsx:414-425. Needs both a bank and an account to be
  // worth printing — a bank name with no number tells the customer nothing.
  //
  // Shown on invoices and quotes, NOT purchase orders. The prototype put it on
  // invoices and POs; the schema comment says "shown on invoices/quotes". They
  // disagree, so this follows the intent of each: an invoice and a quote both
  // ask the customer for money (a quote carries a deposit), while on a PO the
  // business is the buyer — its own account number has no purpose there, and
  // printing it for every supplier is needless exposure.
  // The letterhead is the BUSINESS's, not ours — this document goes from them
  // to their customer, so heading it "Worklog" was never right. v65 had this
  // correct: logo, or the business's own initial. Worklog's credit stays in
  // the footer, where attribution belongs.
  //
  // logo_url must already be renderable by the time it arrives here: the PDF
  // route inlines it as a data: URI first, because that page has its network
  // blocked. See /api/render-pdf.
  const initial = (business.name || "W").trim().charAt(0).toUpperCase();
  const logoHTML = business.logo_url
    ? `<img src="${esc(business.logo_url)}" alt="" style="width:44px;height:44px;object-fit:contain;border-radius:8px;" />`
    : `<div class="brand-mark">${esc(initial)}</div>`;

  // Payslip working, printed above the amounts it explains.
  const payslipMeta = isPayslip && doc.payslip_meta && doc.payslip_meta.length > 0 ? doc.payslip_meta : null;
  const payslipMetaHTML = payslipMeta
    ? `
  <div style="margin-bottom:20px;padding:12px 14px;background:#F0F9FF;border-radius:8px;border-left:4px solid #0C4A6E;">
    <div style="font-size:11px;font-weight:700;color:#0C4A6E;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">This pay run</div>
    <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:0;">
      ${payslipMeta
        .map(
          (m) =>
            `<tr><td style="padding:3px 0;color:#64748b;width:140px;vertical-align:top;">${esc(m.label)}</td><td style="padding:3px 0;color:#111;">${esc(m.value)}</td></tr>`
        )
        .join("")}
    </table>
  </div>`
    : "";

  const hasBanking = !!business.bank_name && !!business.bank_account;
  const bankingHTML =
    hasBanking && (isInvoice || kind === "quote")
      ? `
  <div style="margin-top:24px;padding:14px 16px;background:#F0F9FF;border-radius:8px;border-left:4px solid #0C4A6E;">
    <div style="font-size:11px;font-weight:700;color:#0C4A6E;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">Payment details — please use these to pay</div>
    <table style="width:100%;border-collapse:collapse;font-size:12px;">
      <tr><td style="padding:3px 0;color:#64748b;width:120px;">Bank</td><td style="padding:3px 0;font-weight:600;color:#111;">${esc(business.bank_name)}</td></tr>
      <tr><td style="padding:3px 0;color:#64748b;">Account no.</td><td style="padding:3px 0;font-weight:600;color:#111;">${esc(business.bank_account)}</td></tr>
      ${business.bank_branch ? `<tr><td style="padding:3px 0;color:#64748b;">Branch code</td><td style="padding:3px 0;font-weight:600;color:#111;">${esc(business.bank_branch)}</td></tr>` : ""}
      <tr><td style="padding:3px 0;color:#64748b;">Reference</td><td style="padding:3px 0;font-weight:700;color:#0C4A6E;">${esc(business.bank_ref ? `${business.bank_ref} / ${doc.doc_number}` : doc.doc_number)}</td></tr>
    </table>
  </div>`
      : "";

  // Owner's own Terms & Conditions — only on the documents that go to a customer
  // (quote + invoice), never a PO/payslip/credit note. white-space:pre-wrap keeps
  // the line breaks the owner typed; esc() neutralises any HTML in the text.
  const termsHTML =
    (isInvoice || kind === "quote") && doc.terms && doc.terms.trim()
      ? `
  <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb;">
    <div style="font-size:11px;font-weight:700;color:#0C4A6E;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Terms &amp; Conditions</div>
    <div style="font-size:11px;color:#64748b;line-height:1.6;white-space:pre-wrap;">${esc(doc.terms)}</div>
  </div>`
      : "";

  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>${esc(docTitle)} ${esc(doc.doc_number)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; background: #fff; color: #111; padding: 40px; width: 700px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #0C4A6E; padding-bottom: 20px; margin-bottom: 28px; }
  .brand { display: flex; align-items: center; gap: 10px; }
  .brand-mark { background: #F59E0B; border-radius: 8px; width: 36px; height: 36px; display:flex; align-items:center; justify-content:center; font-weight: 900; font-size: 18px; color: #0C4A6E; font-family: monospace; }
  .brand-name { font-size: 13px; font-weight: 900; color: #0C4A6E; letter-spacing: 1.5px; }
  .doc-title { font-size: 26px; font-weight: 800; color: #0C4A6E; text-align: right; }
  .doc-number { font-size: 12px; color: #64748b; text-align: right; margin-top: 4px; }
  .meta-row { display: flex; justify-content: space-between; margin-bottom: 28px; gap: 24px; }
  .meta-block { flex: 1; }
  .meta-label { font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 6px; }
  .meta-value { font-size: 13px; color: #111; line-height: 1.5; }
  .meta-value strong { font-weight: 700; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  thead th { background: #F0F9FF; padding: 10px 8px; font-size: 11px; font-weight: 700; color: #0C4A6E; text-transform: uppercase; letter-spacing: 0.5px; text-align: left; }
  thead th:nth-child(2) { text-align: center; }
  thead th:nth-child(3) { text-align: right; }
  .totals { display: flex; justify-content: flex-end; }
  .totals-box { width: 280px; }
  .totals-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 13px; color: #374151; }
  .totals-row.final { border-top: 2px solid #0C4A6E; margin-top: 6px; padding-top: 12px; font-size: 18px; font-weight: 800; color: #0C4A6E; }
  .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #94a3b8; line-height: 1.6; }
  .vat-note { font-size: 10px; color: #94a3b8; margin-top: 4px; }
  /* Trial watermark — position:fixed so Chromium repeats it on every printed page. */
  .wm { position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%) rotate(-32deg); font-size: 82px; font-weight: 900; color: rgba(220,38,38,0.10); letter-spacing: 6px; white-space: nowrap; z-index: 9999; pointer-events: none; }
</style>
</head>
<body>
  ${watermark ? `<div class="wm">TRIAL — NOT FINAL</div>` : ""}
  <div class="header">
    <div class="brand">
      ${logoHTML}
      <div>
        <div class="brand-name">${esc(business.name || "Your Business")}</div>
        <div style="font-size:10px;color:#94a3b8;">${esc(business.phone || business.email || "")}</div>
      </div>
    </div>
    <div>
      <div class="doc-title">${esc(docTitle)}</div>
      <div class="doc-number">${esc(doc.doc_number)} &nbsp;·&nbsp; ${esc(doc.issue_date || todayStr())}</div>
    </div>
  </div>

  <div class="meta-row">
    <div class="meta-block">
      <div class="meta-label">From</div>
      <div class="meta-value">
        <strong>${esc(business.name || "Your Business Name")}</strong><br/>
        ${business.address ? esc(business.address) + "<br/>" : ""}
        ${business.phone ? esc(business.phone) + "<br/>" : ""}
        ${business.email ? esc(business.email) : ""}
      </div>
      ${business.vat_number ? `<div class="vat-note">VAT Reg No: ${esc(business.vat_number)}</div>` : ""}
    </div>
    <div class="meta-block">
      <div class="meta-label">${esc(recipientLabel)}</div>
      <div class="meta-value">
        <strong>${esc(doc.recipient_name)}</strong>
        ${doc.recipient_address ? `<br/>${esc(doc.recipient_address)}` : ""}
      </div>
      ${isInvoice && doc.due_date ? `<div class="vat-note" style="margin-top:8px;"><strong>Due date:</strong> ${esc(doc.due_date)}</div>` : ""}
      ${isPO && doc.requested_delivery ? `<div class="vat-note" style="margin-top:8px;"><strong>Requested delivery:</strong> ${esc(doc.requested_delivery)}</div>` : ""}
      ${!isInvoice && !isPO && !isPayslip && !isCreditNote && doc.valid_until ? `<div class="vat-note" style="margin-top:8px;">Valid until ${esc(doc.valid_until)}</div>` : ""}
      ${isPayslip && doc.due_date ? `<div class="vat-note" style="margin-top:8px;"><strong>Pay date:</strong> ${esc(doc.due_date)}</div>` : ""}
      ${isCreditNote && doc.reference_doc_number ? `<div class="vat-note" style="margin-top:8px;"><strong>Against invoice:</strong> ${esc(doc.reference_doc_number)}</div>` : ""}
      ${isCreditNote && doc.reason ? `<div class="vat-note" style="margin-top:4px;">Reason: ${esc(doc.reason)}</div>` : ""}
    </div>
  </div>

  ${payslipMetaHTML}
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
${bankingHTML}${termsHTML}
  <div class="footer">
    ${
      isCreditNote
        ? "This credit note reverses part or all of the invoice above. Retain it for your records."
        : isPayslip
        ? "This is a computer-generated payslip. Retain it for your records."
        : isPO
          ? "This purchase order is subject to the terms agreed with the supplier."
          : isInvoice
            ? hasBanking
              ? "Please pay by the due date above using the payment details shown. Thank you for your business."
              : "Please make payment by the due date above. Thank you for your business."
            : `This quote is valid until ${esc(doc.valid_until || "30 days from the issue date")}. Reply to accept or for any questions.`
    }
    <br/>Generated via Worklog — worklog.co.za${
      watermark
        ? `<br/><strong style="color:#dc2626;">Draft — made on a free Worklog trial. Start a plan to issue this as a final document.</strong>`
        : ""
    }
  </div>
</body>
</html>`;
}
