import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, emailConfigured } from "@/lib/email/resend";
import { trialEndingEmail, paymentFailedEmail } from "@/lib/email/templates";

export const runtime = "nodejs";
// A handful of sends, each a network round-trip; give it room past the 15s default.
export const maxDuration = 60;

// Runs daily via Vercel Cron (vercel.json), after the DB jobs that set the states
// it reads — expire_trials (02:30 UTC) and run_dunning (03:00 UTC) — so a business
// that entered read-only/past_due overnight is picked up the same morning.
//
// It never duplicates the state machine: it reads the current subscription state
// and sends each warning ONCE, marking a *_notified_at column so a business is
// never emailed twice for the same event. The past-due mark is cleared by the ITN
// on the next successful payment, so a later lapse warns again.

const GRACE_DAYS = 7; // must match run_dunning() in migration 0073
const TRIAL_WARN_DAYS = 3; // warn this many days before a trial ends
const DAY_MS = 86_400_000;
// Bound each run so the maxDuration timeout can't bisect the loop mid-iteration
// (which would leave a sent-but-unmarked row). Comfortably above real volume; any
// overflow is picked up the next day. Well within Vercel Hobby's single daily cron.
const BATCH_LIMIT = 200;

export async function GET(request: Request) {
  // Only the scheduler may run this. Vercel Cron sends Authorization: Bearer
  // <CRON_SECRET> when CRON_SECRET is set; fail closed otherwise.
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!emailConfigured()) {
    return NextResponse.json({ skipped: "email_not_configured" });
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "admin_unavailable" }, { status: 503 });
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
  const checkoutUrl = `${origin}/billing/checkout`;
  const now = Date.now();
  const nowIso = new Date(now).toISOString();

  // The owner's login email + business name for a subscription, or null if we
  // can't resolve either (nothing to send to).
  const recipientFor = async (businessId: string): Promise<{ email: string; name: string } | null> => {
    const { data: member } = await admin
      .from("business_members")
      .select("user_id")
      .eq("business_id", businessId)
      .eq("role", "owner")
      .limit(1)
      .maybeSingle();
    if (!member?.user_id) return null;
    const { data: userRes } = await admin.auth.admin.getUserById(member.user_id);
    const email = userRes?.user?.email;
    if (!email) return null;
    const { data: biz } = await admin.from("business_profiles").select("name").eq("id", businessId).maybeSingle();
    return { email, name: biz?.name ?? "" };
  };

  let trialSent = 0;
  let pastDueSent = 0;
  let failed = 0;
  let markFailed = 0;

  // ── Trials ending within TRIAL_WARN_DAYS, not yet warned ──
  const trialCutoffIso = new Date(now + TRIAL_WARN_DAYS * DAY_MS).toISOString();
  const { data: endingTrials } = await admin
    .from("subscriptions")
    .select("business_id, current_period_end")
    .eq("status", "trialing")
    .is("trial_ending_notified_at", null)
    .gt("current_period_end", nowIso)
    .lte("current_period_end", trialCutoffIso)
    .limit(BATCH_LIMIT);

  for (const sub of endingTrials ?? []) {
    const to = await recipientFor(sub.business_id);
    if (!to) continue;
    const daysLeft = Math.max(1, Math.ceil((new Date(sub.current_period_end!).getTime() - now) / DAY_MS));
    const { subject, html } = trialEndingEmail({ businessName: to.name, daysLeft, checkoutUrl });
    const res = await sendEmail({ to: to.email, subject, html, idempotencyKey: `trial-ending:${sub.business_id}:${sub.current_period_end}` });
    if (!res.ok) {
      failed++;
      continue;
    }
    trialSent++;
    // Guard on the status we selected in: if the trial converted or expired
    // between SELECT and now, don't mark (and don't wrongly suppress later).
    const { error: markErr } = await admin
      .from("subscriptions")
      .update({ trial_ending_notified_at: nowIso })
      .eq("business_id", sub.business_id)
      .eq("status", "trialing");
    if (markErr) {
      markFailed++;
      console.error("[cron/notifications] trial mark failed —", markErr.message);
    }
  }

  // ── Past-due (dunning grace), not yet warned ──
  const { data: pastDue } = await admin
    .from("subscriptions")
    .select("business_id, current_period_end")
    .eq("status", "past_due")
    .is("past_due_notified_at", null)
    .limit(BATCH_LIMIT);

  for (const sub of pastDue ?? []) {
    const to = await recipientFor(sub.business_id);
    if (!to) continue;
    const graceEnd = sub.current_period_end ? new Date(sub.current_period_end).getTime() + GRACE_DAYS * DAY_MS : now;
    const graceDays = Math.max(0, Math.ceil((graceEnd - now) / DAY_MS));
    const { subject, html } = paymentFailedEmail({ businessName: to.name, graceDays, billingUrl: checkoutUrl });
    const res = await sendEmail({ to: to.email, subject, html, idempotencyKey: `past-due:${sub.business_id}:${sub.current_period_end}` });
    if (!res.ok) {
      failed++;
      continue;
    }
    pastDueSent++;
    // Guard on status: if a payment recovered the row (ITN set it active) between
    // SELECT and now, don't mark it — otherwise the stale mark would suppress the
    // warning on its next genuine lapse.
    const { error: markErr } = await admin
      .from("subscriptions")
      .update({ past_due_notified_at: nowIso })
      .eq("business_id", sub.business_id)
      .eq("status", "past_due");
    if (markErr) {
      markFailed++;
      console.error("[cron/notifications] past_due mark failed —", markErr.message);
    }
  }

  return NextResponse.json({ trialSent, pastDueSent, failed, markFailed });
}
