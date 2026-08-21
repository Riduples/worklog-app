"use client";

import { useState } from "react";
import Link from "next/link";
import { useIncome } from "@/lib/supabase/hooks/useIncome";
import { useExpenses } from "@/lib/supabase/hooks/useExpenses";
import { useBusinessProfile } from "@/lib/supabase/hooks/useBusinessProfile";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Chips } from "@/components/ui/Chips";
import { useTaxRates, incomeNet, expenseNet, AGE_BANDS, type AgeBand } from "@/lib/taxRates";
import { TAX_ENTITY_TYPES, canQualifySbc, isIndividuallyTaxed, type TaxEntityType } from "@/lib/entityTypes";
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
  const { data: business } = useBusinessProfile();
  const taxRates = useTaxRates();

  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  const defaultPeriod = month <= 8 ? `${year}-P1` : `${year}-P2`;

  const [period, setPeriod] = useState(defaultPeriod);
  // Entity type and the tax regimes default from the saved business profile, so
  // the estimate is right without re-entering anything. Each can be overridden
  // here for a what-if without touching the profile — null means "use the saved
  // value". These are the two axes SARS keeps separate: the legal form, and the
  // preferential regime (SBC / Turnover Tax) layered on top of it.
  const [entityOverride, setEntityOverride] = useState<TaxEntityType | null>(null);
  const [sbcOverride, setSbcOverride] = useState<boolean | null>(null);
  const [turnoverOverride, setTurnoverOverride] = useState<boolean | null>(null);
  const [ageBand, setAgeBand] = useState<AgeBand>("under65");
  const [deductions, setDeductions] = useState("");
  const [sharePct, setSharePct] = useState("100");
  const [medMembers, setMedMembers] = useState("1");
  const [priorPaid, setPriorPaid] = useState("");

  const entity: TaxEntityType = entityOverride ?? (business?.tax_entity_type as TaxEntityType | null) ?? "sole_proprietor";
  const onTurnoverTax = turnoverOverride ?? business?.on_turnover_tax ?? false;
  // SBC is only meaningful for a company / CC / co-op, and never at the same time
  // as Turnover Tax (which already replaces income tax). Guard both so a stale
  // flag from a since-changed entity can't apply the wrong scale.
  const isSbc = canQualifySbc(entity) && !onTurnoverTax && (sbcOverride ?? business?.is_sbc ?? false);
  const individual = isIndividuallyTaxed(entity);
  const canTurnover = entity !== "trust"; // trusts can't register for Turnover Tax

  const taxYear = parseInt(period.split("-")[0]);
  const periodNum = period.split("-")[1];

  // Owner's capital/drawings (is_personal) aren't business income or cost, and a
  // credit-note settlement (a refund) is not turnover — exclude both, the same as
  // Profit & Loss, VAT201 and the compliance threshold do, so the estimate isn't
  // distorted by money that isn't trading.
  const businessIncome = (income ?? []).filter((r) => !r.is_personal && !r.is_credit_settlement);
  const businessExpenses = (expenses ?? []).filter((r) => !r.is_personal && !r.is_credit_settlement);
  // Net of VAT: VAT collected on a sale is SARS's money passing through, never
  // the owner's income, so taxing it would overstate the estimate. Same reason
  // Profit & Loss uses incomeNet/expenseNet — and both sides must use it, or a
  // VAT vendor's deductible costs read gross while income reads net.
  const ytdIncome = businessIncome.reduce((s, r) => s + incomeNet(r), 0);
  // Turnover Tax is levied on gross taxable turnover (receipts), not net profit,
  // so it needs the total amount rather than incomeNet. A micro business on
  // turnover tax is usually not VAT-registered, so the two normally coincide.
  const ytdTurnover = businessIncome.reduce((s, r) => s + Number(r.amount), 0);
  const ytdExpense = businessExpenses.reduce((s, r) => s + expenseNet(r), 0);
  const ytdProfit = ytdIncome - ytdExpense;
  // P1 covers the first six months, so double it for the annual estimate.
  const annualisedProfit = periodNum === "P1" ? ytdProfit * 2 : ytdProfit;
  const annualisedTurnover = periodNum === "P1" ? ytdTurnover * 2 : ytdTurnover;

  const deductionsAmt = parseFloat(deductions || "0");
  // A partner is taxed only on their share of the partnership's profit — the
  // partnership itself isn't a taxpayer. Everyone else is taxed on the whole.
  const shareFraction = entity === "partnership" ? Math.min(100, Math.max(0, parseFloat(sharePct || "100"))) / 100 : 1;
  const shareOfProfit = annualisedProfit * shareFraction;
  const taxableIncome = Math.max(0, shareOfProfit - deductionsAmt);
  const medCredit = taxRates.calcMedicalCredit(parseInt(medMembers || "1"));

  // Rebates stack with age and only apply to a natural person — a company, trust
  // or turnover-tax business gets none.
  const rebate = taxRates.calcRebate(ageBand);

  // Five ways the same records are taxed, chosen by legal form + regime:
  //   turnover tax        → the Sixth Schedule scale on TURNOVER, no rebates
  //   sole prop / partner → individual PAYE tables on their share, then rebates
  //   SBC                 → the reduced small-business sliding scale, no rebates
  //   trust               → the flat trust rate, no rebates
  //   company / CC / co-op→ the flat company rate, no rebates
  let grossTax: number;
  let netTax: number;
  if (onTurnoverTax) {
    grossTax = taxRates.calcTurnoverTax(annualisedTurnover);
    netTax = grossTax;
  } else if (individual) {
    grossTax = taxRates.calcPAYE(taxableIncome);
    netTax = Math.max(0, grossTax - rebate - medCredit);
  } else if (isSbc) {
    grossTax = taxRates.calcSBC(taxableIncome);
    netTax = Math.max(0, grossTax);
  } else if (entity === "trust") {
    grossTax = taxableIncome * taxRates.TRUST_TAX_RATE;
    netTax = Math.max(0, grossTax);
  } else {
    grossTax = taxableIncome * taxRates.COMPANY_TAX_RATE;
    netTax = Math.max(0, grossTax);
  }

  // Warn rather than silently mis-estimate when turnover has outgrown the regime.
  const overTurnoverCeiling = onTurnoverTax && annualisedTurnover > taxRates.TURNOVER_TAX_MAX;

  // The SBC 0%-band top and the marginal rates above it, read from the active
  // scale so the explainer below never drifts from what calcSBC actually uses.
  const sbcThreshold = taxRates.SBC_BRACKETS.find((b) => b.rate > 0)?.from ?? 0;
  const sbcRates = taxRates.SBC_BRACKETS.filter((b) => b.rate > 0)
    .map((b) => `${Math.round(b.rate * 100)}%`)
    .join(" / ");
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
        ← Compliance &amp; Financials
      </Link>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0C4A6E", margin: "4px 0 18px" }}>
        {onTurnoverTax ? "Turnover Tax — interim payment (TT02)" : "Provisional Tax — IRP6"}
      </h1>

      <div style={{ background: "#F0F9FF", border: "1.5px solid #7DD3FC", borderRadius: 12, padding: "11px 14px", marginBottom: 14, fontSize: 12, color: "#0369A1", lineHeight: 1.6 }}>
        {onTurnoverTax ? (
          <>
            <span style={{ fontWeight: 700 }}>📅 Turnover Tax (TT02)</span> — On the Sixth Schedule you pay two interim
            amounts a year on your turnover instead of provisional tax. This estimates each — submit the actual TT02 via
            eFiling.
          </>
        ) : (
          <>
            <span style={{ fontWeight: 700 }}>📅 IRP6 Provisional Tax</span> — Estimate what you owe SARS for each provisional
            tax period. This is a planning tool — submit your actual IRP6 return via eFiling or your accountant.
          </>
        )}
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

      <Field label="Business type — how you're registered with SARS">
        <Chips
          options={TAX_ENTITY_TYPES.map((e) => e.label)}
          selected={TAX_ENTITY_TYPES.find((e) => e.id === entity)?.label ?? ""}
          onSelect={(label) => {
            const found = TAX_ENTITY_TYPES.find((e) => e.label === label);
            if (found) setEntityOverride(found.id);
          }}
        />
        {business?.tax_entity_type == null && (
          <p style={{ fontSize: 11, color: "#64748b", marginTop: 6, lineHeight: 1.5 }}>
            Set this once in Business Details and every tax tool uses it automatically.
          </p>
        )}
      </Field>

      {/* Turnover Tax is a regime a qualifying micro business elects into — it
          rides on top of the entity type, it isn't one of them. Trusts can't use it. */}
      {canTurnover && (
        <Field label="Turnover Tax (micro business)">
          <button
            type="button"
            onClick={() => setTurnoverOverride(!onTurnoverTax)}
            style={{ width: "100%", textAlign: "left", padding: "12px 14px", borderRadius: 12, border: `1.5px solid ${onTurnoverTax ? "#0C4A6E" : "#e2e8f0"}`, background: onTurnoverTax ? "#F0F9FF" : "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}
          >
            <span style={{ fontSize: 18 }}>{onTurnoverTax ? "✅" : "⬜"}</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: onTurnoverTax ? "#0C4A6E" : "#111" }}>Registered for Turnover Tax</div>
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                A single tax on turnover up to R{taxRates.TURNOVER_TAX_MAX.toLocaleString("en-ZA")}/year, replacing income &amp;
                provisional tax.
              </div>
            </div>
          </button>
        </Field>
      )}

      {/* SBC is a company / CC / co-op that qualifies for a reduced sliding scale
          under s12E — not a separate entity type. Only offered for those forms,
          and never alongside Turnover Tax. */}
      {canQualifySbc(entity) && !onTurnoverTax && (
        <Field label="Small Business Corporation (SBC)">
          <button
            type="button"
            onClick={() => setSbcOverride(!isSbc)}
            style={{ width: "100%", textAlign: "left", padding: "12px 14px", borderRadius: 12, border: `1.5px solid ${isSbc ? "#0C4A6E" : "#e2e8f0"}`, background: isSbc ? "#F0F9FF" : "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}
          >
            <span style={{ fontSize: 18 }}>{isSbc ? "✅" : "⬜"}</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: isSbc ? "#0C4A6E" : "#111" }}>Qualifies as an SBC</div>
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>Reduced sliding scale instead of the flat company rate.</div>
            </div>
          </button>
        </Field>
      )}

      {isSbc && (
        <div style={{ background: "#fff7ed", border: "1.5px solid #fed7aa", borderRadius: 12, padding: "11px 14px", marginBottom: 14, fontSize: 12, color: "#92400e", lineHeight: 1.6 }}>
          <span style={{ fontWeight: 700 }}>Small Business Corporation (SBC)</span> — a reduced sliding scale (0% up to R
          {sbcThreshold.toLocaleString("en-ZA")}, then {sbcRates}) instead of the flat {(taxRates.COMPANY_TAX_RATE * 100).toFixed(0)}%
          company rate. You only qualify if all shareholders are individuals, turnover is under R20 million, the company holds no
          shares in other companies, and it isn&apos;t mainly a personal-service or investment business. Not sure? Check with your
          accountant.
        </div>
      )}

      {overTurnoverCeiling && (
        <div style={{ background: "#FEF2F2", border: "1.5px solid #FCA5A5", borderRadius: 12, padding: "11px 14px", marginBottom: 14, fontSize: 12, color: "#991B1B", lineHeight: 1.6 }}>
          ⚠️ Your annualised turnover ({fmt(annualisedTurnover)}) is above the R
          {taxRates.TURNOVER_TAX_MAX.toLocaleString("en-ZA")} Turnover Tax ceiling. A business over the ceiling must leave the
          Turnover Tax system and move to normal income tax — speak to your accountant.
        </div>
      )}

      {/* Age and medical credits only affect a natural person's tax — never a
          company, trust or turnover-tax business. */}
      {individual && !onTurnoverTax && (
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

      {entity === "partnership" && !onTurnoverTax && (
        <Field label="Your share of the partnership (%)">
          <Input type="number" value={sharePct} onChange={setSharePct} placeholder="e.g. 50" />
          <p style={{ fontSize: 11, color: "#64748b", marginTop: 6, lineHeight: 1.5 }}>
            A partnership isn&apos;t taxed itself — each partner is taxed on their share of the profit. Enter yours.
          </p>
        </Field>
      )}

      <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: "12px 14px", marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
          From your Worklog records (year-to-date)
        </div>
        {(onTurnoverTax
          ? ([
              ["Total turnover logged", ytdTurnover],
              [`Annualised turnover (${periodNum === "P1" ? "×2 for P1 estimate" : "full year"})`, annualisedTurnover],
            ] as [string, number][])
          : ([
              ["Total income logged", ytdIncome],
              ["Total expenses logged", ytdExpense],
              ["Net profit (year-to-date)", ytdProfit],
              [`Annualised profit (${periodNum === "P1" ? "×2 for P1 estimate" : "full year"})`, annualisedProfit],
            ] as [string, number][])
        ).map(([l, v]) => (
          <div key={l} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 13, color: "#374151" }}>{l}</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#0C4A6E" }}>{fmt(v)}</span>
          </div>
        ))}
      </div>

      {!onTurnoverTax && (
        <Field label="Allowable deductions - optional">
          <Input type="number" value={deductions} onChange={setDeductions} placeholder="e.g. 50000 (home office, retirement annuity)" />
        </Field>
      )}

      {individual && !onTurnoverTax && (
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
          {onTurnoverTax ? "Estimated TT02" : "Estimated IRP6"} — {period.replace("-", " ")}
        </div>
        <DarkRow
          label={onTurnoverTax ? "Taxable turnover (annualised)" : "Taxable income (annualised)"}
          value={fmt(onTurnoverTax ? annualisedTurnover : taxableIncome)}
        />
        <DarkRow
          label={
            onTurnoverTax
              ? `Turnover tax (Sixth Schedule ${taxRates.TAX_YEAR})`
              : individual
                ? `Gross tax (SARS tables ${taxRates.TAX_YEAR})`
                : isSbc
                  ? `Small business tax (SBC scale ${taxRates.TAX_YEAR})`
                  : entity === "trust"
                    ? `Trust tax (${(taxRates.TRUST_TAX_RATE * 100).toFixed(0)}%)`
                    : `Company tax (${(taxRates.COMPANY_TAX_RATE * 100).toFixed(0)}%)`
          }
          value={fmt(grossTax)}
        />
        {individual && !onTurnoverTax && (
          <DarkRow
            label={ageBand === "under65" ? "Less: primary rebate" : `Less: rebates (primary + age ${ageBand === "75plus" ? "75+" : "65+"})`}
            value={`−${fmt(rebate)}`}
          />
        )}
        {individual && !onTurnoverTax && <DarkRow label="Less: medical tax credits" value={`−${fmt(medCredit)}`} />}
        <DarkRow label={onTurnoverTax ? "Annual turnover tax" : "Annual tax liability"} value={fmt(netTax)} />
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.15)", marginTop: 8, paddingTop: 10 }}>
          <DarkRow label={periodNum === "P1" ? "50% due — Period 1" : "Balance due — Period 2"} value={fmt(taxDue)} highlight />
        </div>
        <div style={{ fontSize: 11, color: "#38BDF8", marginTop: 8 }}>Due date: {dueDate} · Pay via eFiling or your accountant</div>
      </div>

      {onTurnoverTax ? (
        <div style={{ background: "#fff7ed", border: "1.5px solid #fed7aa", borderRadius: 12, padding: "12px 14px", fontSize: 12, color: "#92400e", lineHeight: 1.7 }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Key Turnover Tax facts — {taxRates.TAX_YEAR}</div>
          <div>• A single tax on turnover — replaces income tax, provisional tax, CGT and dividends tax</div>
          <div>• Only for a qualifying turnover up to R{taxRates.TURNOVER_TAX_MAX.toLocaleString("en-ZA")}/year</div>
          <div>• Interim payments (TT02): 1st by 31 August, 2nd by end February</div>
          <div>• Final return (TT03) after year-end</div>
          <div>
            • Submit via: <span style={{ fontWeight: 700 }}>SARS eFiling or your tax practitioner</span>
          </div>
        </div>
      ) : (
        <div style={{ background: "#fff7ed", border: "1.5px solid #fed7aa", borderRadius: 12, padding: "12px 14px", fontSize: 12, color: "#92400e", lineHeight: 1.7 }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Key provisional tax facts — {taxRates.TAX_YEAR}</div>
          <div>• Period 1 (P1): Based on first 6 months income, due 31 August</div>
          <div>• Period 2 (P2): Based on full year income, due last day of February</div>
          <div>• Penalty: 20% if estimate is more than 20% below actual tax</div>
          <div>• Threshold: Individuals aren&apos;t required to register if taxable income is below R30,000/year</div>
          <div>
            • Submit via: <span style={{ fontWeight: 700 }}>SARS eFiling or your tax practitioner</span>
          </div>
        </div>
      )}
    </div>
  );
}
