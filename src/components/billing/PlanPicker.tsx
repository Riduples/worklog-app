"use client";

import { PLAN_FEATURES, PLAN_ORDER, TIERS, type Plan } from "@/lib/tiers";

/**
 * The three plans, side by side, as a real choice.
 *
 * Used at signup and on the checkout page. Every plan is priced — there is no
 * free tier — so this never pretends Shoebox costs nothing.
 */
export function PlanPicker({
  selected,
  onSelect,
  currentPlan,
}: {
  selected: Plan;
  onSelect: (plan: Plan) => void;
  /** If set, plans at or below it are marked as already held. */
  currentPlan?: Plan;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {PLAN_ORDER.map((plan) => {
        const tier = TIERS[plan];
        const copy = PLAN_FEATURES[plan];
        const isSelected = selected === plan;
        const isCurrent = currentPlan === plan;

        return (
          <button
            key={plan}
            type="button"
            onClick={() => onSelect(plan)}
            style={{
              width: "100%",
              textAlign: "left",
              padding: "14px 16px",
              borderRadius: 14,
              border: `2px solid ${isSelected ? tier.color : "#e2e8f0"}`,
              background: isSelected ? tier.bg : "#fff",
              cursor: "pointer",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 16, color: isSelected ? tier.color : "#cbd5e1" }}>{isSelected ? "◉" : "○"}</span>
                <span style={{ fontSize: 15, fontWeight: 800, color: isSelected ? tier.color : "#111" }}>{tier.label}</span>
                {isCurrent && (
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 10, background: "#f0fdf4", color: "#166534" }}>
                    Your plan
                  </span>
                )}
              </div>
              <span style={{ fontSize: 15, fontWeight: 800, color: isSelected ? tier.color : "#64748b" }}>{tier.price}</span>
            </div>

            <div style={{ fontSize: 11, color: "#64748b", marginBottom: isSelected ? 8 : 0, paddingLeft: 24 }}>{copy.tagline}</div>

            {/* Only the selected plan lists its features — three open lists on a
                phone is a wall of text at the exact moment someone is deciding. */}
            {isSelected && (
              <div style={{ paddingLeft: 24 }}>
                {copy.features.map((f) => (
                  <div key={f} style={{ display: "flex", gap: 6, fontSize: 12, color: "#374151", marginBottom: 3, lineHeight: 1.5 }}>
                    <span style={{ color: tier.color, fontWeight: 700 }}>✓</span>
                    <span>{f}</span>
                  </div>
                ))}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
