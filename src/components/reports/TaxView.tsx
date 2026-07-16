"use client";

import { useState } from "react";
import Link from "next/link";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { useIncome } from "@/lib/supabase/hooks/useIncome";
import { useExpenses } from "@/lib/supabase/hooks/useExpenses";
import { useBusinessProfile } from "@/lib/supabase/hooks/useBusinessProfile";
import { useCurrentMember } from "@/lib/supabase/hooks/useCurrentMember";
import { BusinessTaxDetailsModal } from "@/components/modals/BusinessTaxDetailsModal";
import { UpgradeModal } from "@/components/modals/UpgradeModal";
import { useTaxRates } from "@/lib/taxRates";
import { fmt } from "@/lib/format";
import { canSee, type ToolId } from "@/lib/permissions";
import { isLocked, type Plan } from "@/lib/tiers";

const TOOLS: { id: ToolId; href: string; icon: string; label: string }[] = [
  { id: "vat201", href: "/vat201", icon: "🏦", label: "VAT201" },
  { id: "emp201", href: "/emp201", icon: "👷", label: "EMP201" },
  { id: "provtax", href: "/provtax", icon: "📅", label: "Prov Tax" },
  { id: "taxjar", href: "/taxjar", icon: "🫙", label: "Tax Jar" },
  { id: "compliance", href: "/compliance", icon: "✅", label: "Compliance" },
  { id: "ageanalysis", href: "/age-analysis", icon: "⏳", label: "Age Analysis" },
  { id: "profitloss", href: "/profit-loss", icon: "📈", label: "Profit & Loss" },
];

export function TaxView() {
  const { data: income } = useIncome();
  const { data: expenses } = useExpenses();
  const { data: business } = useBusinessProfile();
  const { data: currentMember } = useCurrentMember();
  const { TAX_JAR_RATE } = useTaxRates();

  const [showDetails, setShowDetails] = useState(false);
  const [upgradeFeature, setUpgradeFeature] = useState<ToolId | null>(null);

  const member = currentMember ?? { role: "owner", permissions: {} };
  const plan = (business?.plan ?? "shoebox") as Plan;
  const isOwner = member.role === "owner";

  const totalIncome = (income ?? []).reduce((s, r) => s + Number(r.amount), 0);
  const taxJar = (income ?? []).reduce((s, r) => s + Number(r.tax_jar_amount || 0), 0);
  // "Paid to SARS" = any expense filed under a Tax — category (VAT/PAYE payments).
  const paidToSARS = (expenses ?? [])
    .filter((r) => (r.sars_category ?? "").startsWith("Tax —"))
    .reduce((s, r) => s + Number(r.amount), 0);
  const netJar = taxJar - paidToSARS;

  // Break-even hourly rate calculator (derived, not saved).
  const [monthlyExpenses, setMonthlyExpenses] = useState("");
  const [billableHours, setBillableHours] = useState("");
  const expensesNum = parseFloat(monthlyExpenses) || 0;
  const hoursNum = parseFloat(billableHours) || 0;
  const breakEvenRate = hoursNum > 0 ? (expensesNum / hoursNum) * 1.3 : 0; // +30% profit buffer
  const profitRate = breakEvenRate * 1.3;

  return (
    <div style={{ padding: "20px 16px 100px" }}>
      <Link href="/dashboard" style={{ fontSize: 12, color: "#64748b" }}>
        ← Dashboard
      </Link>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: "#1B4332", margin: "4px 0 18px" }}>Tax &amp; SARS</h1>

      <div style={{ background: "#1B4332", borderRadius: 16, padding: "18px", marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>
          🏦 TAX JAR (SET ASIDE FOR SARS)
        </div>
        <div style={{ fontSize: 28, fontWeight: 800, color: netJar >= 0 ? "#6EE7B7" : "#FCA5A5" }}>{fmt(netJar)}</div>
        <div style={{ fontSize: 12, color: "#A7F3D0", marginTop: 4 }}>
          {fmt(taxJar)} set aside · {fmt(paidToSARS)} already paid to SARS
        </div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>
          {(TAX_JAR_RATE * 100).toFixed(0)}% of {fmt(totalIncome)} total income logged
        </div>
      </div>

      {/* Business tax details */}
      <div style={{ background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 14, padding: "14px 16px", marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.6 }}>Business tax details</div>
          {isOwner && business && (
            <button
              onClick={() => setShowDetails(true)}
              style={{ background: "#f0f9ff", border: "1.5px solid #bfdbfe", borderRadius: 8, padding: "4px 10px", fontSize: 11, fontWeight: 700, color: "#1e40af", cursor: "pointer" }}
            >
              Edit
            </button>
          )}
        </div>
        <div style={{ fontSize: 12, color: "#374151", lineHeight: 1.8 }}>
          <div>🏦 VAT: {business?.vat_number ? `${business.vat_number} · ${business.vat_period}` : "Not registered"}</div>
          <div>👷 PAYE ref: {business?.paye_ref || "Not set"}</div>
          <div>🎓 SDL: {business?.sdl_registered ? "Registered" : "Not registered"}</div>
        </div>
      </div>

      {/* Tool tiles */}
      <div style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
        Tax &amp; compliance tools
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
        {TOOLS.filter((t) => canSee(member, t.id)).map((t) => {
          const locked = isLocked(plan, t.id);
          const style: React.CSSProperties = {
            display: "block",
            width: "100%",
            textAlign: "left",
            background: "#fff",
            border: "1.5px solid #e2e8f0",
            borderRadius: 13,
            padding: "14px 16px",
            fontSize: 14,
            fontWeight: 700,
            color: locked ? "#94a3b8" : "#1B4332",
            cursor: "pointer",
          };
          return locked ? (
            <button key={t.id} onClick={() => setUpgradeFeature(t.id)} style={style}>
              🔒 {t.label}
            </button>
          ) : (
            <Link key={t.id} href={t.href} style={style}>
              {t.icon} {t.label}
            </Link>
          );
        })}
      </div>

      <div style={{ background: "#fff", borderRadius: 14, padding: "16px", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 12 }}>
          What should I charge? (rate calculator)
        </div>
        <Field label="Your monthly running costs">
          <Input value={monthlyExpenses} onChange={setMonthlyExpenses} type="number" placeholder="e.g. 8000" />
        </Field>
        <Field label="Billable hours per month">
          <Input value={billableHours} onChange={setBillableHours} type="number" placeholder="e.g. 120" />
        </Field>

        {breakEvenRate > 0 && (
          <div style={{ background: "#f0fdf4", borderRadius: 12, padding: "12px 14px", marginTop: 8, fontSize: 13, color: "#166534" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span>Minimum rate (break-even + buffer)</span>
              <strong>{fmt(breakEvenRate)}/h</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Healthy rate (with profit)</span>
              <strong>{fmt(profitRate)}/h</strong>
            </div>
          </div>
        )}
      </div>

      {showDetails && business && <BusinessTaxDetailsModal business={business} onClose={() => setShowDetails(false)} />}
      {upgradeFeature && business && (
        <UpgradeModal feature={upgradeFeature} currentPlan={plan} businessId={business.id} isOwner={isOwner} onClose={() => setUpgradeFeature(null)} />
      )}
    </div>
  );
}
