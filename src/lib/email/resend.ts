import { Resend } from "resend";

// Transactional email via Resend. Server-only — RESEND_API_KEY is a secret and
// must never reach the browser. The module is a clean no-op when the key is
// unset, so the app runs fine before email is configured (like the AI routes),
// and every send returns a result rather than throwing, so a mail failure never
// takes down the caller (a nightly cron, an ITN handler).
const DEFAULT_FROM = "Worklog <noreply@worklog.co.za>";

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  /** Stable per-event key so a retried run is deduped by Resend, not just by us. */
  idempotencyKey?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: "not_configured" };
  const from = process.env.EMAIL_FROM || DEFAULT_FROM;
  try {
    const resend = new Resend(key);
    const { error } = await resend.emails.send(
      { from, to: opts.to, subject: opts.subject, html: opts.html },
      opts.idempotencyKey ? { idempotencyKey: opts.idempotencyKey } : undefined
    );
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
