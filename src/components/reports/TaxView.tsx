"use client";

import { useState } from "react";
import Link from "next/link";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { useIncome } from "@/lib/supabase/hooks/useIncome";
import { useTaxRates } from "@/lib/taxRates";
import { fmt } from "@/lib/format";

export function TaxView() {
  const { data: income } = useIncome();
  const { TAX_JAR_RATE } = useTaxRates();

  const totalIncome = (income ?? []).reduce((s, r) => s + Number(r.amount), 0);
  const taxJar = (income ?? []).reduce((s, r) => s + Number(r.tax_jar_amount || 0), 0);

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
        <div style={{ fontSize: 28, fontWeight: 800, color: "#6EE7B7" }}>{fmt(taxJar)}</div>
        <div style={{ fontSize: 12, color: "#A7F3D0", marginTop: 4 }}>
          {(TAX_JAR_RATE * 100).toFixed(0)}% of {fmt(totalIncome)} total income logged
        </div>
      </div>

      <div style={{ background: "#f0fdf4", borderRadius: 14, padding: "14px 16px", marginBottom: 20, fontSize: 12, color: "#166534", lineHeight: 1.5 }}>
        Keep this amount aside for provisional tax. WORKLOG sets aside {(TAX_JAR_RATE * 100).toFixed(0)}% of every income entry
        automatically so you&apos;re never caught short at SARS time.
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
    </div>
  );
}
