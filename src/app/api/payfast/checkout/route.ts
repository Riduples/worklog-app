import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { payfastConfig, buildSubscriptionFields } from "@/lib/payfast";
import { PLAN_ORDER, type Plan } from "@/lib/tiers";

export const runtime = "nodejs";

const isPaidPlan = (v: string | null): v is Plan => v === "solo" || v === "trade" || v === "structured";

// A minimal HTML escape for the hidden-field values we render. The values are
// ours (ids, plan names, amounts), but item_name is a label and the origin is
// header-derived, so escaping keeps a stray quote from breaking out of an
// attribute regardless.
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function backToCheckout(origin: string, reason: string) {
  return NextResponse.redirect(`${origin}/billing/checkout?error=${encodeURIComponent(reason)}`, { status: 303 });
}

/**
 * Starts a PayFast subscription for the chosen plan. Reached by the browser
 * navigating here (a link on the checkout page), so it answers with a tiny page
 * that auto-submits the signed form to PayFast — the signature is built here,
 * server-side, so the passphrase never reaches the browser.
 *
 * This does not change the plan. Only the ITN does, once PayFast confirms the
 * money. All this decides is who may be sent to pay: a signed-in owner, moving
 * up (never down or sideways), on a configured gateway.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = process.env.NEXT_PUBLIC_SITE_URL || url.origin;
  const config = payfastConfig();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login?next=/billing/checkout`, { status: 303 });

  const plan = url.searchParams.get("plan");
  if (!isPaidPlan(plan)) return backToCheckout(origin, "Choose a plan to subscribe to.");

  if (!config.configured) return backToCheckout(origin, "Card payments aren't switched on yet.");

  // Only an owner may start billing, and only as an upgrade. The real guard is
  // that the plan can't move without a verified payment (update_business_plan +
  // the subscription trigger); this just avoids sending the wrong person to pay.
  const { data: membership } = await supabase
    .from("business_members")
    .select("business_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .single();
  if (!membership || membership.role !== "owner") {
    return backToCheckout(origin, "Only the business owner can change the plan.");
  }

  // A business only "holds" a paid plan once a verified payment made its
  // subscription active (or past_due — it paid, then a renewal lapsed). A trial
  // carries business_profiles.plan='structured' by design, and read-only/cancelled
  // businesses keep whatever plan they last had, so gating on business.plan would
  // reject every tier for anyone who hasn't paid yet — the exact people we're
  // sending here to pay. Gate on the subscription instead: only apply the
  // upgrade-only rule to a genuinely paid subscription; otherwise any tier is a
  // valid first purchase.
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("status, tier")
    .eq("business_id", membership.business_id)
    .maybeSingle();
  const hasPaidPlan = sub?.status === "active" || sub?.status === "past_due";
  if (hasPaidPlan) {
    const currentPlan = (sub?.tier ?? "solo") as Plan;
    if (PLAN_ORDER.indexOf(plan) <= PLAN_ORDER.indexOf(currentPlan)) {
      return backToCheckout(origin, "That isn't an upgrade from your current plan.");
    }
  }

  const mPaymentId = crypto.randomUUID();
  const fields = buildSubscriptionFields({
    config,
    plan,
    businessId: membership.business_id,
    mPaymentId,
    email: user.email ?? "",
    returnUrl: `${origin}/billing/return`,
    cancelUrl: `${origin}/billing/cancel`,
    notifyUrl: `${origin}/api/payfast/notify`,
  });

  const inputs = fields.map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`).join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Redirecting to PayFast…</title></head>
<body style="font-family:system-ui;text-align:center;padding:40px;color:#0C4A6E">
<p>Taking you to PayFast${config.mode === "sandbox" ? " (test mode)" : ""} to complete your payment…</p>
<form id="pf" action="${esc(config.processUrl)}" method="post">${inputs}</form>
<script>document.getElementById('pf').submit();</script>
</body></html>`;

  return new NextResponse(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}
