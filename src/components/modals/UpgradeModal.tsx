"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { TIERS, UPGRADE_DETAILS, upgradeTargetPlan, type Plan } from "@/lib/tiers";
import type { ToolId } from "@/lib/permissions";
import { useUpdateBusinessPlan } from "@/lib/supabase/hooks/useBusinessProfile";

// Keep these honest against tiers.ts: anything listed here as Business-only
// must actually be in SOLO_LOCKED (or genuinely gated in the UI). PAYE/UIF/SDL
// are calculated on every plan, and Age Analysis is deliberately unlocked on
// Solo — so neither belongs in the Business list.
const SOLO_FEATURES = [
  "Everything in Shoebox",
  "Quotes, invoices & staff register for up to 2 employees",
  "Full pay calculation — PAYE, UIF & SDL",
  "VAT201, provisional tax & age analysis",
  "Purchase orders & supplier invoices",
];
const BUSINESS_FEATURES = [
  "Unlimited employees",
  "Share professional payslips with your staff",
  "EMP201 monthly payroll return for SARS",
  "Recurring invoices — weekly, monthly, quarterly or annual",
  "Multi-user team access with permission control",
];

export function UpgradeModal({
  feature,
  currentPlan,
  businessId,
  isOwner,
  onClose,
}: {
  feature: ToolId | "team";
  currentPlan: Plan;
  businessId: string;
  isOwner: boolean;
  onClose: () => void;
}) {
  const [upgraded, setUpgraded] = useState(false);
  // Frozen at mount: the mutation below invalidates business_profile and the
  // parent re-renders with a new currentPlan while this modal is still open,
  // which would otherwise recompute the target tier mid-flow (e.g. jump from
  // Solo to Business right after the Solo upgrade succeeds).
  const [targetTier] = useState<Plan>(() => upgradeTargetPlan(currentPlan, feature));
  const updatePlan = useUpdateBusinessPlan();

  const detail = UPGRADE_DETAILS[feature] || { title: "Paid Feature", desc: "Upgrade to unlock this feature.", icon: "🔒" };
  const target = TIERS[targetTier];

  const handleUpgrade = () => {
    updatePlan.mutate({ businessId, plan: targetTier }, { onSuccess: () => setUpgraded(true) });
  };

  if (upgraded) {
    return (
      <Modal title="Plan updated" onClose={onClose}>
        <div style={{ textAlign: "center", padding: "16px 8px" }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>🎉</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#0C4A6E", marginBottom: 6 }}>
            You&apos;re now on {target.label}
          </div>
          <div style={{ fontSize: 13, color: "#64748b" }}>Refresh to see the newly unlocked tools.</div>
        </div>
        <button
          onClick={onClose}
          style={{ width: "100%", background: "#1e40af", border: "none", borderRadius: 14, padding: 15, fontSize: 15, fontWeight: 700, color: "#fff", cursor: "pointer", marginTop: 8 }}
        >
          Done
        </button>
      </Modal>
    );
  }

  return (
    <Modal title={`Upgrade to ${target.label}`} onClose={onClose}>
      <div style={{ textAlign: "center", padding: "16px 8px 8px" }}>
        <div style={{ fontSize: 44, marginBottom: 12 }}>{detail.icon}</div>
        <div style={{ fontSize: 17, fontWeight: 800, color: "#0C4A6E", marginBottom: 8 }}>{detail.title}</div>
        <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.7, marginBottom: 20 }}>{detail.desc}</div>
      </div>
      <div style={{ background: "#eff6ff", border: "1.5px solid #bfdbfe", borderRadius: 14, padding: "16px 18px", marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#1e40af", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
          {target.label} — {target.price}
        </div>
        {(targetTier === "solo" ? SOLO_FEATURES : BUSINESS_FEATURES).map((f) => (
          <div key={f} style={{ display: "flex", gap: 8, marginBottom: 6, fontSize: 12, color: "#1e40af" }}>
            <span>✓</span>
            <span>{f}</span>
          </div>
        ))}
      </div>
      <div style={{ background: "#F0F9FF", border: "1.5px solid #7DD3FC", borderRadius: 14, padding: "12px 16px", marginBottom: 16, fontSize: 12, color: "#0369A1" }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>
          You&apos;re on {TIERS[currentPlan]?.label ?? "Shoebox"}
          {TIERS[currentPlan]?.price ? ` — ${TIERS[currentPlan].price}` : ""}
        </div>
        <div>
          {currentPlan === "shoebox"
            ? "Shoebox covers Money, Sales and your Diary — the basics done properly."
            : "Upgrade anytime — your data stays intact."}
        </div>
      </div>

      {isOwner ? (
        <button
          onClick={handleUpgrade}
          disabled={updatePlan.isPending}
          style={{
            width: "100%",
            background: updatePlan.isPending ? "#94a3b8" : "#1e40af",
            border: "none",
            borderRadius: 14,
            padding: 15,
            fontSize: 15,
            fontWeight: 700,
            cursor: updatePlan.isPending ? "default" : "pointer",
            color: "#fff",
            marginBottom: 8,
          }}
        >
          {updatePlan.isPending ? "Updating..." : `Upgrade to ${target.label} →`}
        </button>
      ) : (
        <div style={{ background: "#fff7ed", border: "1.5px solid #fed7aa", borderRadius: 12, padding: "12px 14px", fontSize: 12, color: "#92400e", marginBottom: 8 }}>
          Ask the business owner to upgrade the plan.
        </div>
      )}
      {updatePlan.isError && (
        <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 8 }}>
          {updatePlan.error instanceof Error ? updatePlan.error.message : "Couldn't update the plan."}
        </p>
      )}
      <button style={{ width: "100%", background: "none", border: "none", color: "#64748b", fontSize: 13, cursor: "pointer", padding: 6 }} onClick={onClose}>
        Maybe later
      </button>
    </Modal>
  );
}
