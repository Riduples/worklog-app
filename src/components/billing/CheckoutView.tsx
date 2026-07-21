"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { PlanPicker } from "@/components/billing/PlanPicker";
import { PLAN_ORDER, TIERS, type Plan } from "@/lib/tiers";
import { useBusinessProfile, useUpdateBusinessPlan } from "@/lib/supabase/hooks/useBusinessProfile";
import { BackLink } from "@/components/ui/BackLink";

const isPlan = (v: string | null): v is Plan => !!v && (PLAN_ORDER as string[]).includes(v);

export function CheckoutView({ payfastReady = false, sandbox = false }: { payfastReady?: boolean; sandbox?: boolean }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: business } = useBusinessProfile();
  const updatePlan = useUpdateBusinessPlan();
  const [error, setError] = useState("");

  const currentPlan = (business?.plan ?? "solo") as Plan;
  const requested = searchParams.get("plan");
  const [selected, setSelected] = useState<Plan>(isPlan(requested) ? requested : currentPlan);
  // The checkout route bounces back here with ?error=… when it won't start a
  // payment (not an owner, not an upgrade, gateway off) — surface it plainly.
  const redirectError = searchParams.get("error");

  const tier = TIERS[selected];
  const isDowngrade = PLAN_ORDER.indexOf(selected) < PLAN_ORDER.indexOf(currentPlan);
  const isSame = selected === currentPlan;

  // A downgrade needs no payment and is allowed straight from the client
  // (update_business_plan permits it; only upgrades are locked to a verified
  // payment). Refusing to let someone leave would be hostile.
  const handleDowngrade = () => {
    if (!business) return;
    setError("");
    updatePlan.mutate(
      { businessId: business.id, plan: selected },
      {
        onSuccess: () => router.push("/dashboard"),
        onError: (e) => setError(e instanceof Error ? e.message : "Couldn't change your plan."),
      }
    );
  };

  return (
    <div style={{ padding: "20px 16px 100px" }}>
      <BackLink />
      <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0C4A6E", margin: "4px 0 6px" }}>Choose your plan</h1>
      <p style={{ fontSize: 12, color: "#64748b", marginBottom: 18, lineHeight: 1.5 }}>
        Every plan is billed monthly and you can change or cancel it any time.
      </p>

      <PlanPicker selected={selected} onSelect={setSelected} currentPlan={currentPlan} />

      <div style={{ marginTop: 18 }}>
        {isSame ? (
          <div style={{ background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 12, padding: "13px 16px", fontSize: 13, color: "#64748b", textAlign: "center" }}>
            {`You're already on ${tier.label}.`}
          </div>
        ) : isDowngrade ? (
          <>
            <div style={{ background: "#fff7ed", border: "1.5px solid #fed7aa", borderRadius: 12, padding: "12px 14px", marginBottom: 12, fontSize: 12, color: "#92400e", lineHeight: 1.6 }}>
              {`Moving to ${tier.label} keeps everything you've already captured — you just won't be able to add new records in the tools ${tier.label} doesn't include. You can come back any time.`}
            </div>
            <button
              onClick={handleDowngrade}
              disabled={updatePlan.isPending}
              style={{ width: "100%", background: "#fff", color: "#b45309", border: "1.5px solid #fed7aa", borderRadius: 14, padding: 15, fontWeight: 700, fontSize: 14, cursor: "pointer" }}
            >
              {updatePlan.isPending ? "Changing..." : `Move to ${tier.label}`}
            </button>
          </>
        ) : payfastReady ? (
          <>
            {/* A plain navigation to the checkout route, which builds the signed
                form server-side and forwards to PayFast. Not a fetch — the
                browser needs to actually land on PayFast's page. */}
            <a
              href={`/api/payfast/checkout?plan=${selected}`}
              style={{ display: "block", width: "100%", boxSizing: "border-box", background: "#0C4A6E", color: "#fff", border: "none", borderRadius: 14, padding: 16, fontWeight: 800, fontSize: 15, textAlign: "center", textDecoration: "none" }}
            >
              {`Pay ${tier.price} with PayFast`}
            </a>
            <div style={{ background: "#F0F9FF", border: "1.5px solid #BAE6FD", borderRadius: 12, padding: "12px 14px", marginTop: 10, fontSize: 12, color: "#0C4A6E", lineHeight: 1.6 }}>
              {sandbox
                ? "🧪 Test mode — this uses PayFast's sandbox, so no real money moves. Your plan activates once PayFast confirms the test payment."
                : `🔒 Secured by PayFast. You'll be taken to PayFast to pay, then brought back. ${tier.label} activates the moment your payment is confirmed.`}
            </div>
          </>
        ) : (
          <>
            {/* No merchant credentials configured — keep the step honest and
                inert rather than a live-looking button that leads nowhere. */}
            <button
              disabled
              style={{ width: "100%", background: "#e2e8f0", color: "#94a3b8", border: "none", borderRadius: 14, padding: 16, fontWeight: 800, fontSize: 15, cursor: "not-allowed" }}
            >
              {`Pay ${tier.price} with PayFast`}
            </button>
            <div style={{ background: "#F0F9FF", border: "1.5px solid #BAE6FD", borderRadius: 12, padding: "12px 14px", marginTop: 10, fontSize: 12, color: "#0C4A6E", lineHeight: 1.6 }}>
              🔒 Card payments aren&apos;t switched on yet — our PayFast registration is still being approved. Nothing is
              charged and nothing is stored. Until then you can keep using Worklog, and we&apos;ll let you know
              the moment {tier.label} can be activated.
            </div>
          </>
        )}

        {(error || redirectError) && <p style={{ color: "#dc2626", fontSize: 13, marginTop: 12 }}>{error || redirectError}</p>}

        <Link
          href="/dashboard"
          style={{ display: "block", textAlign: "center", marginTop: 14, fontSize: 13, color: "#64748b", textDecoration: "none" }}
        >
          Not now — back to my dashboard
        </Link>
      </div>
    </div>
  );
}
