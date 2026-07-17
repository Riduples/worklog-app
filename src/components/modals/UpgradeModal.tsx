"use client";

import Link from "next/link";
import { Modal } from "@/components/ui/Modal";
import { PLAN_FEATURES, TIERS, UPGRADE_DETAILS, upgradeTargetPlan, type Plan } from "@/lib/tiers";
import type { ToolId } from "@/lib/permissions";

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
  const targetTier = upgradeTargetPlan(currentPlan, feature);
  const detail = UPGRADE_DETAILS[feature] || { title: "Paid Feature", desc: "Upgrade to unlock this feature.", icon: "🔒" };
  const target = TIERS[targetTier];

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
        {PLAN_FEATURES[targetTier].features.map((f) => (
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

      {/* Goes to checkout rather than changing the plan here. A plan is only
          granted by a verified payment now (migration 0054), so calling
          update_business_plan from this button would simply be refused. */}
      {isOwner ? (
        <Link
          href={`/billing/checkout?plan=${targetTier}`}
          onClick={onClose}
          style={{
            display: "block",
            width: "100%",
            textAlign: "center",
            background: "#1e40af",
            borderRadius: 14,
            padding: 15,
            fontSize: 15,
            fontWeight: 700,
            color: "#fff",
            textDecoration: "none",
            marginBottom: 8,
            boxSizing: "border-box",
          }}
        >
          {`See ${target.label} — ${target.price} →`}
        </Link>
      ) : (
        <div style={{ background: "#fff7ed", border: "1.5px solid #fed7aa", borderRadius: 12, padding: "12px 14px", fontSize: 12, color: "#92400e", marginBottom: 8 }}>
          Ask the business owner to upgrade the plan.
        </div>
      )}
      <button style={{ width: "100%", background: "none", border: "none", color: "#64748b", fontSize: 13, cursor: "pointer", padding: 6 }} onClick={onClose}>
        Maybe later
      </button>
    </Modal>
  );
}
