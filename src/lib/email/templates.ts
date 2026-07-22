import { esc } from "@/lib/docgen/esc";

// Transactional email bodies. Table-based, inline-styled and image-free so they
// render the same in Gmail, Outlook and Apple Mail. All dynamic text (a business
// name) goes through esc() — it comes from user input and must never inject HTML.

const NAVY = "#0C4A6E";
const INK = "#1e293b";
const MUTED = "#64748b";

function layout(opts: { heading: string; body: string; cta?: { label: string; url: string }; preheader?: string }): string {
  const button = opts.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:18px;"><tr><td>
         <a href="${esc(opts.cta.url)}" style="display:inline-block;background:${NAVY};color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:12px 24px;border-radius:10px;">${esc(opts.cta.label)}</a>
       </td></tr></table>`
    : "";
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#f0f0ef;">
  ${opts.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(opts.preheader)}</div>` : ""}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0f0ef;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
        <tr><td style="background:${NAVY};padding:20px 28px;">
          <span style="color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-weight:800;font-size:16px;letter-spacing:2px;">WORKLOG</span>
        </td></tr>
        <tr><td style="padding:28px;font-family:Arial,Helvetica,sans-serif;color:${INK};">
          <h1 style="margin:0 0 14px;font-size:20px;font-weight:800;color:${NAVY};">${esc(opts.heading)}</h1>
          <div style="font-size:14px;line-height:1.65;color:${INK};">${opts.body}</div>
          ${button}
        </td></tr>
        <tr><td style="padding:18px 28px;border-top:1px solid #eef0f3;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:${MUTED};line-height:1.6;">
          Worklog — every rand, every job, logged.<br/>
          You're receiving this because you have a Worklog account. Questions? Just reply to this email.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function trialEndingEmail(opts: { businessName: string; daysLeft: number; checkoutUrl: string }): { subject: string; html: string } {
  const name = opts.businessName || "there";
  const days = opts.daysLeft;
  const dayWord = days === 1 ? "day" : "days";
  return {
    subject: `Your Worklog trial ends in ${days} ${dayWord}`,
    html: layout({
      heading: `Your free trial ends in ${days} ${dayWord}`,
      preheader: "Pick a plan to keep adding and editing in Worklog.",
      body: `<p style="margin:0 0 12px;">Hi ${esc(name)},</p>
        <p style="margin:0 0 12px;">Your Worklog free trial ends in <strong>${days} ${dayWord}</strong>. After that your records stay safe — you can still view and download everything — but to keep adding and editing you'll need to choose a plan.</p>
        <p style="margin:0;">Plans start at R79/month, all VAT-inclusive, and it takes a minute to set up.</p>`,
      cta: { label: "Choose a plan", url: opts.checkoutUrl },
    }),
  };
}

export function paymentFailedEmail(opts: { businessName: string; graceDays: number; billingUrl: string }): { subject: string; html: string } {
  const name = opts.businessName || "there";
  const days = opts.graceDays;
  const dayWord = days === 1 ? "day" : "days";
  return {
    subject: "We couldn't process your Worklog payment",
    html: layout({
      heading: "We couldn't process your last payment",
      preheader: "PayFast will retry — please make sure your account has funds.",
      body: `<p style="margin:0 0 12px;">Hi ${esc(name)},</p>
        <p style="margin:0 0 12px;">Your latest Worklog subscription payment didn't go through. PayFast will retry over the next few days, so the simplest fix is to make sure your account or card has funds.</p>
        <p style="margin:0;">You keep full access for <strong>${days} more ${dayWord}</strong>. If it still hasn't gone through by then your account moves to view-only — your records stay safe, and everything picks up right where you left off once a payment succeeds.</p>`,
      cta: { label: "View billing", url: opts.billingUrl },
    }),
  };
}
