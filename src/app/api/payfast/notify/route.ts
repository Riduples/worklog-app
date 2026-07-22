import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { payfastConfig, verifySignature, formatAmount, type PfPairs } from "@/lib/payfast";
import { PLAN_PRICE_ZAR, type Plan } from "@/lib/tiers";

export const runtime = "nodejs";

// The PayFast ITN (Instant Transaction Notification). PayFast POSTs here,
// server to server, after a payment — this is the only thing that moves a
// business onto a paid plan, so it trusts nothing it isn't forced to.
//
// Four gates, in order, before a single row is written to act on it:
//   1. the signature we can reproduce from the posted fields + our passphrase,
//   2. PayFast itself confirming the notification is real (post it back, get
//      "VALID") — the check that a forged request can't pass,
//   3. the payment actually completed,
//   4. the amount equals the price of the plan being claimed — because
//      custom_str2 carries the tier, but the money is what we bill on.
// Only then does the subscription get written (service role), and the database
// trigger moves business_profiles.plan. A failed gate is recorded and
// acknowledged, never acted on.

const isPlan = (v: string | null | undefined): v is Plan => v === "solo" || v === "trade" || v === "structured";

/** PayFast wants a 200 or it retries; we acknowledge receipt even when we reject
 *  the contents, so a junk or replayed ITN isn't retried forever. */
const ack = () => new NextResponse("OK", { status: 200 });

export async function POST(request: Request) {
  const config = payfastConfig();
  const sourceIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  // Read the body raw and in order — the signature is over the fields as sent.
  const raw = await request.text();
  const params = new URLSearchParams(raw);
  const pairs: PfPairs = [];
  for (const [k, v] of params) if (k !== "signature") pairs.push([k, v]);
  const payload = Object.fromEntries(params);

  const signatureValid = verifySignature(pairs, config.passphrase, params.get("signature") ?? "");

  const businessId = params.get("custom_str1");
  const plan = params.get("custom_str2");
  const paymentStatus = params.get("payment_status");
  const amountGross = params.get("amount_gross");
  const token = params.get("token") || params.get("pf_payment_id");

  // Record every ITN verbatim before doing anything with it — if money and plan
  // ever disagree, the answer is here. Best-effort: a logging failure must not
  // make us NAK a valid payment.
  const admin = (() => {
    try {
      return createAdminClient();
    } catch (e) {
      console.error("[payfast/notify] admin client unavailable —", e instanceof Error ? e.message : e);
      return null;
    }
  })();
  if (admin) {
    await admin
      .from("payment_events")
      .insert({
        business_id: businessId,
        event_type: paymentStatus,
        raw_payload: payload,
        signature_valid: signatureValid,
        source_ip: sourceIp,
      })
      .then(({ error }) => error && console.error("[payfast/notify] event log failed —", error.message));
  }

  // Gate 1 + 2: our signature check, then PayFast's own confirmation.
  if (!signatureValid) {
    console.warn("[payfast/notify] signature mismatch, ignoring");
    return ack();
  }
  const confirmed = await confirmWithPayfast(config.validateUrl, raw);
  if (!confirmed) {
    console.warn("[payfast/notify] PayFast did not confirm the notification, ignoring");
    return ack();
  }

  // Gate 3 + 4: the payment completed, and the money matches the plan claimed.
  if (paymentStatus !== "COMPLETE") return ack(); // pending/failed/cancelled: nothing to grant
  if (!isPlan(plan) || !businessId) {
    console.warn("[payfast/notify] confirmed payment with no plan/business to attribute it to");
    return ack();
  }
  if (!amountGross || formatAmount(Number(amountGross)) !== formatAmount(PLAN_PRICE_ZAR[plan])) {
    console.warn(`[payfast/notify] amount ${amountGross} doesn't match ${plan} (${PLAN_PRICE_ZAR[plan]}) — not granting`);
    return ack();
  }

  if (!admin) return new NextResponse("service unavailable", { status: 503 }); // let PayFast retry

  // The plan itself is moved by the sync_plan_from_subscription trigger; all we
  // do is state what was paid for. Keyed on business_id (unique), so a repeat
  // ITN or a monthly renewal updates the one row rather than piling up.
  const periodEnd = new Date();
  periodEnd.setMonth(periodEnd.getMonth() + 1);
  const { error } = await admin
    .from("subscriptions")
    .upsert(
      {
        business_id: businessId,
        tier: plan,
        status: "active",
        payfast_token: token,
        current_period_end: periodEnd.toISOString(),
        // A successful payment ends any dunning grace: clear the past-due warning
        // flag so a future lapse sends a fresh "payment failed" email.
        past_due_notified_at: null,
      },
      { onConflict: "business_id" }
    );
  if (error) {
    console.error("[payfast/notify] subscription upsert failed —", error.message);
    return new NextResponse("could not record subscription", { status: 500 }); // retryable
  }

  return ack();
}

/** Post the notification back to PayFast; a real one comes back "VALID". */
async function confirmWithPayfast(validateUrl: string, raw: string): Promise<boolean> {
  try {
    const res = await fetch(validateUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: raw,
    });
    const text = (await res.text()).trim();
    return text.startsWith("VALID");
  } catch (e) {
    console.error("[payfast/notify] confirmation request failed —", e instanceof Error ? e.message : e);
    return false;
  }
}
