"use client";

import { useState } from "react";
import { PeriodSelector } from "@/components/ui/PeriodSelector";
import { useMileageTrips } from "@/lib/supabase/hooks/useMileage";
import { useBusinessProfile } from "@/lib/supabase/hooks/useBusinessProfile";
import { PERIOD_LABELS, type Period } from "@/lib/period";
import { expenseCategoryTotals } from "@/lib/pnl";
import { useMoneySummary } from "@/lib/useMoneySummary";
import { fmt } from "@/lib/format";
import { shareReport } from "@/lib/docgen/shareReport";
import { BackLink } from "@/components/ui/BackLink";
import { BankAccountSelector, ALL_ACCOUNTS, type AccountFilter } from "@/components/ui/BankAccountSelector";

export function ProfitLossView() {
  const [period, setPeriod] = useState<Period>("month");
  const [account, setAccount] = useState<AccountFilter>(ALL_ACCOUNTS);
  const { data: mileage } = useMileageTrips();
  const { data: business } = useBusinessProfile();

  // Every money figure comes from the shared summary, so this report and the
  // dashboard hero cannot disagree about the same period — they are now one
  // calculation, not two that happen to call the same function.
  const {
    within,
    isAllAccounts: isAll,
    selectedAccount,
    incomeRows: acctIncome,
    expenseRows: acctExpenses,
    pnl,
    accountBalance: acctBalance,
  } = useMoneySummary(period, account);

  const netProfit = pnl.profit;
  const margin = pnl.revenue > 0 ? (netProfit / pnl.revenue) * 100 : 0;
  const taxJar = acctIncome
    .filter((r) => within(r.transaction_date) && !r.is_credit_settlement && !r.is_personal)
    .reduce((s, r) => s + Number(r.tax_jar_amount || 0), 0);
  const mileageDeduction = (mileage ?? [])
    .filter((t) => within(t.trip_date))
    .reduce((s, t) => s + Number(t.sars_deduction || 0), 0);

  // The breakdown must count exactly the rows that went into "Total costs", or
  // the list sums past the total printed directly above it. That rule lives with
  // computePnl so the two cannot drift apart again.
  const expenseByCategory = expenseCategoryTotals(acctExpenses, within, { cashBasis: !isAll }).slice(0, 8);

  const handleShare = () => {
    const basis = isAll ? "Accrual basis" : `Cash basis · ${selectedAccount?.name ?? "account"}`;
    const lines = [
      `Revenue: ${fmt(pnl.revenue)}`,
      `Costs: ${fmt(pnl.costs)}`,
      `Net profit: ${fmt(netProfit)}`,
      `Margin: ${margin.toFixed(1)}%`,
    ];
    if (expenseByCategory.length > 0) {
      lines.push(``, `Top expense categories:`, ...expenseByCategory.map(([cat, amt]) => `  ${cat}: ${fmt(amt)}`));
    }
    void shareReport("Profit & Loss", `${PERIOD_LABELS[period]} · ${basis}`, lines, business);
  };

  return (
    <div style={{ padding: "20px 16px 100px" }}>
      <BackLink />
      <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0C4A6E", margin: "4px 0 18px" }}>Profit &amp; Loss</h1>

      <BankAccountSelector selected={account} onSelect={setAccount} />

      <PeriodSelector selected={period} onSelect={setPeriod} />

      <div style={{ background: "#0C4A6E", borderRadius: 16, padding: "18px", marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>NET PROFIT</div>
        <div style={{ fontSize: 28, fontWeight: 800, color: netProfit >= 0 ? "#7DD3FC" : "#FCA5A5" }}>{fmt(netProfit)}</div>
        <div style={{ fontSize: 12, color: "#E0F2FE", marginTop: 4 }}>
          {margin.toFixed(1)}% margin ({isAll ? "accrual basis" : `cash basis · ${selectedAccount?.name ?? "account"}`})
        </div>
      </div>

      <div style={{ background: "#fff", borderRadius: 14, padding: "16px", marginBottom: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
        {isAll ? (
          <>
            <Row label="Invoices issued" value={fmt(pnl.invoicesIssued)} />
            <Row label="+ Other cash income" value={fmt(pnl.cashIncomeNotInvoiced)} />
            <Row label="Total revenue" value={fmt(pnl.revenue)} bold />
            <div style={{ height: 12 }} />
            {/* Same shape as revenue above, and in the same order: what was
                incurred (invoices, then credit), then the cash that isn't already in
                either. Showing the full cash expense here would print numbers that
                don't add up. Zero-value accrual rows are hidden so a business that
                uses only one style of payable isn't shown the other reading nil. */}
            {pnl.supplierInvoicesIssued > 0 && <Row label="Supplier invoices" value={fmt(pnl.supplierInvoicesIssued)} color="#b45309" />}
            {pnl.supplierCreditIncurred > 0 && <Row label="Supplier credit" value={fmt(pnl.supplierCreditIncurred)} color="#b45309" />}
            <Row label="+ Other cash expenses" value={fmt(pnl.cashExpensesNotMatched)} color="#b45309" />
            <Row label="Total costs" value={fmt(pnl.costs)} bold color="#b45309" />
          </>
        ) : (
          <>
            <Row label="Money in (excl. VAT)" value={fmt(pnl.revenue)} bold />
            <Row label="Money out" value={fmt(pnl.costs)} bold color="#b45309" />
            <div style={{ borderTop: "1.5px solid #e2e8f0", marginTop: 8, paddingTop: 8 }}>
              <Row label="Net" value={fmt(netProfit)} bold />
            </div>
          </>
        )}
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <div style={{ flex: 1, background: "#F0F9FF", borderRadius: 12, padding: "12px 14px" }}>
          <div style={{ fontSize: 10, color: "#0369A1", fontWeight: 700, textTransform: "uppercase" }}>Tax jar</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#0C4A6E" }}>{fmt(taxJar)}</div>
        </div>
        {isAll ? (
          <div style={{ flex: 1, background: "#F0F9FF", borderRadius: 12, padding: "12px 14px" }}>
            <div style={{ fontSize: 10, color: "#0369A1", fontWeight: 700, textTransform: "uppercase" }}>Mileage deduction</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#0C4A6E" }}>{fmt(mileageDeduction)}</div>
          </div>
        ) : (
          <div style={{ flex: 1, background: "#F0F9FF", borderRadius: 12, padding: "12px 14px" }}>
            <div style={{ fontSize: 10, color: "#0369A1", fontWeight: 700, textTransform: "uppercase" }}>Balance now</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#0C4A6E" }}>{fmt(acctBalance)}</div>
          </div>
        )}
      </div>

      {expenseByCategory.length > 0 && (
        <div style={{ background: "#fff", borderRadius: 14, padding: "16px", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 12 }}>
            Top expense categories
          </div>
          {/* Supplier invoices and supplier credit carry no expense category, so
              in the accrual view this breaks down the cash expenses line only.
              Saying so keeps it from reading as a breakdown of Total costs. */}
          {isAll && (pnl.supplierInvoicesIssued > 0 || pnl.supplierCreditIncurred > 0) && (
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: -8, marginBottom: 12, lineHeight: 1.5 }}>
              Breaks down “Other cash expenses” — supplier invoices and credit are listed above.
            </div>
          )}
          {expenseByCategory.map(([cat, amt]) => (
            <Row key={cat} label={cat} value={fmt(amt)} />
          ))}
        </div>
      )}

      <button
        onClick={handleShare}
        style={{ width: "100%", marginTop: 16, background: "#F0F9FF", color: "#0C4A6E", border: "1.5px solid #BAE6FD", borderRadius: 12, padding: 13, fontWeight: 700, fontSize: 13, cursor: "pointer" }}
      >
        📤 Share report
      </button>
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
