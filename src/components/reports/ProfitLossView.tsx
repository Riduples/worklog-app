"use client";

import { useState } from "react";
import Link from "next/link";
import { PeriodSelector } from "@/components/ui/PeriodSelector";
import { useIncome } from "@/lib/supabase/hooks/useIncome";
import { useExpenses } from "@/lib/supabase/hooks/useExpenses";
import { useInvoices } from "@/lib/supabase/hooks/useInvoices";
import { useLedgerEntries } from "@/lib/supabase/hooks/useLedger";
import { useMileageTrips } from "@/lib/supabase/hooks/useMileage";
import { inPeriod, type Period } from "@/lib/period";
import { incomeNet } from "@/lib/taxRates";
import { fmt } from "@/lib/format";

export function ProfitLossView() {
  const [period, setPeriod] = useState<Period>("month");
  const { data: income } = useIncome();
  const { data: expenses } = useExpenses();
  const { data: invoices } = useInvoices();
  const { data: ledger } = useLedgerEntries();
  const { data: mileage } = useMileageTrips();

  const within = inPeriod(period);

  // Accrual revenue: invoices issued (even if unpaid) + cash income NOT already
  // tied to an invoice (avoids double-counting a paid invoice's income row).
  //
  // Everything here is ex-VAT. invoice_amount already is; cash income is gross,
  // so it goes through incomeNet() — VAT collected on a sale is SARS's money
  // passing through, never revenue. Both income terms must be net or the
  // subtraction wouldn't cancel.
  const invoicesIssued = (invoices ?? [])
    .filter((i) => within(i.issue_date))
    .reduce((s, i) => s + Number(i.invoice_amount), 0);
  const cashIncome = (income ?? []).filter((r) => within(r.transaction_date)).reduce((s, r) => s + incomeNet(r), 0);
  const incomeLinkedToInvoice = (income ?? [])
    .filter((r) => within(r.transaction_date) && r.matched_invoice_id)
    .reduce((s, r) => s + incomeNet(r), 0);
  const totalRevenue = invoicesIssued + (cashIncome - incomeLinkedToInvoice);

  const cashExpense = (expenses ?? []).filter((r) => within(r.transaction_date)).reduce((s, r) => s + Number(r.amount), 0);
  const supplierCreditIncurred = (ledger ?? [])
    .filter((e) => e.ledger_type === "supplier" && within(e.entry_date))
    .reduce((s, e) => s + Number(e.amount), 0);
  const totalCosts = cashExpense + supplierCreditIncurred;

  const netProfit = totalRevenue - totalCosts;
  const margin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
  const taxJar = (income ?? []).filter((r) => within(r.transaction_date)).reduce((s, r) => s + Number(r.tax_jar_amount || 0), 0);
  const mileageDeduction = (mileage ?? [])
    .filter((t) => within(t.trip_date))
    .reduce((s, t) => s + Number(t.sars_deduction || 0), 0);

  const expenseByCategory = Object.entries(
    (expenses ?? [])
      .filter((r) => within(r.transaction_date))
      .reduce<Record<string, number>>((acc, r) => {
        const cat = r.sars_category || r.what_for || "Uncategorised";
        acc[cat] = (acc[cat] || 0) + Number(r.amount);
        return acc;
      }, {})
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  return (
    <div style={{ padding: "20px 16px 100px" }}>
      <Link href="/dashboard" style={{ fontSize: 12, color: "#64748b" }}>
        ← Dashboard
      </Link>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0C4A6E", margin: "4px 0 18px" }}>Profit &amp; Loss</h1>

      <PeriodSelector selected={period} onSelect={setPeriod} />

      <div style={{ background: "#0C4A6E", borderRadius: 16, padding: "18px", marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>NET PROFIT</div>
        <div style={{ fontSize: 28, fontWeight: 800, color: netProfit >= 0 ? "#7DD3FC" : "#FCA5A5" }}>{fmt(netProfit)}</div>
        <div style={{ fontSize: 12, color: "#E0F2FE", marginTop: 4 }}>{margin.toFixed(1)}% margin (accrual basis)</div>
      </div>

      <div style={{ background: "#fff", borderRadius: 14, padding: "16px", marginBottom: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
        <Row label="Invoices issued" value={fmt(invoicesIssued)} />
        <Row label="+ Other cash income" value={fmt(cashIncome - incomeLinkedToInvoice)} />
        <Row label="Total revenue" value={fmt(totalRevenue)} bold />
        <div style={{ height: 12 }} />
        <Row label="Cash expenses" value={fmt(cashExpense)} color="#b45309" />
        <Row label="+ Supplier credit" value={fmt(supplierCreditIncurred)} color="#b45309" />
        <Row label="Total costs" value={fmt(totalCosts)} bold color="#b45309" />
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <div style={{ flex: 1, background: "#F0F9FF", borderRadius: 12, padding: "12px 14px" }}>
          <div style={{ fontSize: 10, color: "#0369A1", fontWeight: 700, textTransform: "uppercase" }}>Tax jar</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#0C4A6E" }}>{fmt(taxJar)}</div>
        </div>
        <div style={{ flex: 1, background: "#F0F9FF", borderRadius: 12, padding: "12px 14px" }}>
          <div style={{ fontSize: 10, color: "#0369A1", fontWeight: 700, textTransform: "uppercase" }}>Mileage deduction</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#0C4A6E" }}>{fmt(mileageDeduction)}</div>
        </div>
      </div>

      {expenseByCategory.length > 0 && (
        <div style={{ background: "#fff", borderRadius: 14, padding: "16px", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 12 }}>
            Top expense categories
          </div>
          {expenseByCategory.map(([cat, amt]) => (
            <Row key={cat} label={cat} value={fmt(amt)} />
          ))}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, bold, color }: { label: string; value: string; bold?: boolean; color?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
      <span style={{ fontSize: 13, color: "#374151" }}>{label}</span>
      <span style={{ fontSize: bold ? 16 : 14, fontWeight: bold ? 800 : 600, color: color ?? "#0C4A6E" }}>{value}</span>
    </div>
  );
}
