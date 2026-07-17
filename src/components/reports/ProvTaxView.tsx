"use client";

import { useState } from "react";
import Link from "next/link";
import { useIncome } from "@/lib/supabase/hooks/useIncome";
import { useExpenses } from "@/lib/supabase/hooks/useExpenses";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Chips } from "@/components/ui/Chips";
import { useTaxRates, incomeNet, AGE_BANDS, type AgeBand } from "@/lib/taxRates";
import { fmt } from "@/lib/format";

// Hoisted out of ProvTaxView: defined inside, it was a new component identity
// on every render, so React threw the whole subtree away and rebuilt it each
// time. Harmless while these are static rows, a real bug the moment one holds
// an input — and it's what the lint rule was pointing at.
function DarkRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
      <span style={{ fontSize: highlight ? 15 : 13, color: highlight ? "#38BDF8" : "#7DD3FC", fontWeight: highlight ? 700 : 400 }}>{label}</span>
      <span style={{ fontSize: highlight ? 22 : 14, fontWeight: highlight ? 900 : 700, color: "#fff" }}>{value}</span>
    </div>
  );
}

export function ProvTaxView() {
  const { data: income } = useIncome();
  const { data: expenses } = useExpenses();
  const taxRates = useTaxRates();

  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  const defaultPeriod = month <= 8 ? `${year}-P1` : `${year}-P2`;

  const [period, setPeriod] = useState(defaultPeriod);
  const [entityType, setEntityType] = useState<"sole_prop" | "company">("sole_prop");
  const [ageBand, setAgeBand] = useState<AgeBand>("under65");
  const [deductions, setDeductions] = useState("");
  const [medMembers, setMedMembers] = useState("1");
  const [priorPaid, setPriorPaid] = useState("");

  const taxYear = parseInt(period.split("-")[0]);
  const periodNum = period.split("-")[1];

  // Net of VAT: VAT collected on a sale is SARS's money passing through, never
  // the owner's income, so taxing it would overstate the estimate. Same reason
  // Profit & Loss uses incomeNet. Rows with no VAT are unaffected.
  const ytdIncome = (income ?? []).reduce((s, r) => s + incomeNet(r), 0);
  const ytdExpense = (expenses ?? []).reduce((s, r) => s + Number(r.amount), 0);
  const ytdProfit = ytdIncome - ytdExpense;
  // P1 covers the first six months, so double it for the annual estimate.
  const annualisedProfit = periodNum === "P1" ? ytdProfit * 2 : ytdProfit;

  const deductionsAmt = parseFloat(deductions || "0");
  const taxableIncome = Math.max(0, annualisedProfit - deductionsAmt);
  const medCredit = taxRates.calcMedicalCredit(parseInt(medMembers || "1"));

  // Rebates stack with age and only apply to a person — a company pays the flat
  // rate with none. Applying just the primary rebate under-credited anyone over
  // 65 by R9,444/year (over 75, R12,589), overstating what they owe SARS.
  const rebate = taxRates.calcRebate(ageBand);
  const grossTax = entityType === "sole_prop" ? taxRates.calcPAYE(taxableIncome) : taxableIncome * taxRates.COMPANY_TAX_RATE;
  const netTax =
    entityType === "sole_prop" ? Math.max(0, grossTax - rebate - medCredit) : Math.max(0, grossTax);
  const taxDue = periodNum === "P1" ? netTax * 0.5 : Math.max(0, netTax - parseFloat(priorPaid || "0"));
  const dueDate = periodNum === "P1" ? `31 August ${taxYear}` : `28 February ${taxYear + 1}`;

  const PERIODS = [
    { value: `${year}-P1`, label: `${year} Period 1 (Feb–Aug)`, due: `Due 31 Aug ${year}` },
    { value: `${year}-P2`, label: `${year} Period 2 (Aug–Feb)`, due: `Due 28 Feb ${year + 1}` },
    { value: `${year + 1}-P1`, label: `${year + 1} Period 1 (Feb–Aug)`, due: `Due 31 Aug ${year + 1}` },
  ];

  return (
    <div style={{ padding: "20px 16px 100px" }}>
      <Link href="/tax" style={{ fontSize: 12, color: "#64748b" }}>
        ← Tax &amp; Compliance
      </Link>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0C4A6E", margin: "4px 0 18px" }}>Provisional Tax — IRP6</h1>

      <div style={{ background: "#F0F9FF", border: "1.5px solid #7DD3FC", borderRadius: 12, padding: "11px 14px", marginBottom: 14, fontSize: 12, color: "#0369A1", lineHeight: 1.6 }}>
        <span style={{ fontWeight: 700 }}>📅 IRP6 Provisional Tax</span> — Estimate what you owe SARS for each provisional tax period. This is a planning tool — submit your actual IRP6 return via eFiling or your accountant.
      </div>

      <Field label="Tax period">
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              style={{ textAlign: "left", padding: "10px 14px", border: `2px solid ${period === p.value ? "#0C4A6E" : "#e2e8f0"}`, borderRadius: 10, background: period === p.value ? "#F0F9FF" : "#fff", cursor: "pointer", display: "flex", justifyContent: "space-between" }}
            >
              <span style={{ fontSize: 13, fontWeight: 700, color: period === p.value ? "#0C4A6E" : "#64748b" }}>{p.label}</span>
              <span style={{ fontSize: 11, color: "#94a3b8" }}>{p.due}</span>
            </button>
          ))}
        </div>
      </Field>

      <Field label="Business type">
        <Chips
          options={["Sole proprietor / Individual", "Company (Pty) Ltd"]}
          selected={entityType === "sole_prop" ? "Sole proprietor / Individual" : "Company (Pty) Ltd"}
          onSelect={(v) => v && setEntityType(v.includes("Sole") ? "sole_prop" : "company")}
        />
      </Field>

      {/* Only asked of an individual — a company pays a flat rate with no
          rebates, so the question would be meaningless there. */}
      {entityType === "sole_prop" && (
        <Field label="Your age">
          <Chips
            options={AGE_BANDS.map((a) => a.label)}
            selected={AGE_BANDS.find((a) => a.id === ageBand)?.label ?? ""}
            onSelect={(v) => {
              const found = AGE_BANDS.find((a) => a.label === v);
              if (found) setAgeBand(found.id);
            }}
          />
          <p style={{ fontSize: 11, color: "#64748b", marginTop: 6, lineHeight: 1.5 }}>
            SARS gives you a bigger rebate from 65, and bigger again from 75 — it lowers what you owe.
          </p>
        </Field>
      )}

      <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: "12px 14px", marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
          From your Worklog records (year-to-date)
        </div>
        {[
          ["Total income logged", ytdIncome],
          ["Total expenses logged", ytdExpense],
          ["Net profit (year-to-date)", ytdProfit],
          [`Annualised profit (${periodNum === "P1" ? "×2 for P1 estimate" : "full year"})`, annualisedProfit],
        ].map(([l, v]) => (
          <div key={l as string} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 13, color: "#374151" }}>{l}</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#0C4A6E" }}>{fmt(v as number)}</span>
          </div>
        ))}
      </div>

      <Field label="Allowable deductions (optional)">
        <Input type="number" value={deductions} onChange={setDeductions} placeholder="e.g. 50000 (home office, retirement annuity)" />
      </Field>

      {entityType === "sole_prop" && (
        <>
          <Field label="Medical aid members">
            <Chips options={["1", "2", "3", "4", "5"]} selected={medMembers} onSelect={(v) => v && setMedMembers(v)} />
          </Field>
          <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 10 }}>Medical credit: {fmt(medCredit)}/year applied</div>
        </>
      )}

      {periodNum === "P2" && (
        <Field label="Amount already paid in Period 1">
          <Input type="number" value={priorPaid} onChange={setPriorPaid} placeholder="0.00" />
        </Field>
      )}

      <div style={{ background: "#0C4A6E", borderRadius: 14, padding: "16px 18px", marginTop: 8, marginBottom: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#7DD3FC", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>
          Estimated IRP6 — {period.replace("-", " ")}
        </div>
        <DarkRow label="Taxable income (annualised)" value={fmt(taxableIncome)} />
        <DarkRow label={entityType === "sole_prop" ? `Gross tax (SARS tables ${taxRates.TAX_YEAR})` : "Company tax (27%)"} value={fmt(grossTax)} />
        {entityType === "sole_prop" && (
          <DarkRow
            label={ageBand === "under65" ? "Less: primary rebate" : `Less: rebates (primary + age ${ageBand === "75plus" ? "75+" : "65+"})`}
            value={`−${fmt(rebate)}`}
          />
        )}
        {entityType === "sole_prop" && <DarkRow label="Less: medical tax credits" value={`−${fmt(medCredit)}`} />}
        <DarkRow label="Annual tax liability" value={fmt(netTax)} />
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.15)", marginTop: 8, paddingTop: 10 }}>
          <DarkRow label={periodNum === "P1" ? "50% due — Period 1" : "Balance due — Period 2"} value={fmt(taxDue)} highlight />
        </div>
        <div style={{ fontSize: 11, color: "#38BDF8", marginTop: 8 }}>Due date: {dueDate} · Pay via eFiling or your accountant</div>
      </div>

      <div style={{ background: "#fff7ed", border: "1.5px solid #fed7aa", borderRadius: 12, padding: "12px 14px", fontSize: 12, color: "#92400e", lineHeight: 1.7 }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>Key provisional tax facts — {taxRates.TAX_YEAR}</div>
        <div>• Period 1 (P1): Based on first 6 months income, due 31 August</div>
        <div>• Period 2 (P2): Based on full year income, due last day of February</div>
        <div>• Penalty: 20% if estimate is more than 20% below actual tax</div>
        <div>• Threshold: Not required if taxable income below R30,000/year</div>
        <div>
          • Submit via: <span style={{ fontWeight: 700 }}>SARS eFiling or your tax practitioner</span>
        </div>
      </div>
    </div>
  );
}
