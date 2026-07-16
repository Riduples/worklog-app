"use client";

import Link from "next/link";
import { useIncome } from "@/lib/supabase/hooks/useIncome";
import { useExpenses } from "@/lib/supabase/hooks/useExpenses";
import { isIncomeTaxPayment } from "@/lib/sarsCategories";
import { useTaxRates, incomeNet } from "@/lib/taxRates";
import { fmt } from "@/lib/format";

// Ported from worklog-v65's TaxJarModal. Every income entry sets aside a
// provision (TAX_JAR_RATE) against the income tax bill; this is where that
// running total lives. The dashboard shows the number, this explains it.
//
// "Already paid" counts only income tax and provisional tax. v65 matched any
// expense whose category contained "sars", which here would sweep in VAT and
// PAYE -- money collected for SARS on someone else's behalf, not settled out of
// this provision. See INCOME_TAX_PAYMENT_CATEGORIES.
export function TaxJarView() {
  const { data: income } = useIncome();
  const { data: expenses } = useExpenses();
  const { TAX_JAR_RATE } = useTaxRates();

  const rows = income ?? [];
  // Net of VAT throughout: the provision is against income tax, and the VAT
  // portion of a sale was never the business's to be taxed on. For a business
  // that isn't VAT-registered vat_amount is 0, so this is just the amount.
  const totalIncome = rows.reduce((s, r) => s + incomeNet(r), 0);
  const totalTaxJar = rows.reduce((s, r) => s + Number(r.tax_jar_amount || 0), 0);
  // The effective rate is derived, not assumed: historical entries keep the
  // rate that applied when they were logged, so this can differ from the
  // current TAX_JAR_RATE and that difference is the interesting part.
  const effectiveRate = totalIncome > 0 ? (totalTaxJar / totalIncome) * 100 : 0;

  const paidTax = (expenses ?? [])
    .filter((e) => isIncomeTaxPayment(e.sars_category))
    .reduce((s, e) => s + Number(e.amount || 0), 0);
  const netJar = totalTaxJar - paidTax;

  const byMonth = new Map<string, { income: number; jar: number }>();
  rows.forEach((r) => {
    const m = (r.transaction_date || "").slice(0, 7);
    if (!m) return;
    const cur = byMonth.get(m) ?? { income: 0, jar: 0 };
    cur.income += incomeNet(r);
    cur.jar += Number(r.tax_jar_amount || 0);
    byMonth.set(m, cur);
  });
  const months = [...byMonth.keys()].sort().reverse().slice(0, 12);
  const biggestMonth = Math.max(1, ...months.map((m) => byMonth.get(m)!.income));

  return (
    <div style={{ padding: "20px 16px 100px" }}>
      <Link href="/tax" style={{ fontSize: 12, color: "#64748b" }}>
        ← Tax &amp; SARS
      </Link>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: "#1B4332", margin: "4px 0 18px" }}>Tax Jar Tracker</h1>

      <div style={{ background: "#F0F9FF", border: "1.5px solid #7DD3FC", borderRadius: 12, padding: "11px 14px", marginBottom: 14, fontSize: 12, color: "#0369A1", lineHeight: 1.6 }}>
        {`🫙 Every time you log income, WORKLOG sets aside ${Math.round(TAX_JAR_RATE * 100)}% as an income tax provision. This shows what you've built up — so SARS is never a surprise. It's a guide, not a SARS return.`}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
        <div style={{ background: "#0C4A6E", borderRadius: 14, padding: "14px 16px" }}>
          <div style={{ fontSize: 11, color: "#7DD3FC", fontWeight: 700, marginBottom: 6 }}>Total set aside</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#fff" }}>{fmt(totalTaxJar)}</div>
          <div style={{ fontSize: 10, color: "#38BDF8", marginTop: 4 }}>
            {`${effectiveRate.toFixed(1)}% of ${fmt(totalIncome)} income`}
          </div>
        </div>
        <div style={{ background: "#fff1f2", border: "1.5px solid #fecdd3", borderRadius: 14, padding: "14px 16px" }}>
          <div style={{ fontSize: 11, color: "#be123c", fontWeight: 700, marginBottom: 6 }}>Already paid to SARS</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#be123c" }}>{fmt(paidTax)}</div>
          <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 4 }}>Income &amp; provisional tax only</div>
        </div>
      </div>

      <div
        style={{
          background: netJar >= 0 ? "#F0F9FF" : "#fff1f2",
          border: `1.5px solid ${netJar >= 0 ? "#BAE6FD" : "#fecdd3"}`,
          borderRadius: 12,
          padding: "12px 16px",
          marginBottom: 18,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#111" }}>Net provision available</div>
          <div style={{ fontSize: 11, color: "#94a3b8" }}>
            {netJar >= 0 ? "Set aside minus what you've already paid" : "You've paid more than you set aside"}
          </div>
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, color: netJar >= 0 ? "#0369A1" : "#be123c" }}>{fmt(netJar)}</div>
      </div>

      {months.length > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
            Monthly breakdown
          </div>
          {months.map((m) => {
            const d = byMonth.get(m)!;
            const pct = d.income > 0 ? (d.jar / d.income) * 100 : 0;
            const barW = (d.income / biggestMonth) * 100;
            return (
              <div key={m} style={{ background: "#f8fafc", borderRadius: 10, padding: "10px 12px", marginBottom: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#111" }}>{m}</span>
                  <span style={{ fontSize: 11, color: "#94a3b8" }}>
                    {`${fmt(d.income)} in → ${fmt(d.jar)} set aside (${pct.toFixed(0)}%)`}
                  </span>
                </div>
                <div style={{ height: 5, background: "#e2e8f0", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${barW}%`, background: "#0C4A6E", borderRadius: 3 }} />
                </div>
              </div>
            );
          })}
        </>
      )}

      {months.length === 0 && (
        <div style={{ textAlign: "center", padding: "32px 0", color: "#94a3b8", fontSize: 13 }}>
          No income logged yet — the tax jar fills automatically as you log income.
        </div>
      )}

      <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 10, padding: "10px 14px", marginTop: 12, fontSize: 11, color: "#92400e", lineHeight: 1.6 }}>
        💡 Paid SARS? Log it as an expense and pick &quot;Income tax paid to SARS&quot; or &quot;Provisional tax paid to SARS&quot; so it comes off the jar here.
      </div>
    </div>
  );
}
