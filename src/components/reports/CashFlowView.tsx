"use client";

import { useState } from "react";
import { PeriodSelector } from "@/components/ui/PeriodSelector";
import { useIncome } from "@/lib/supabase/hooks/useIncome";
import { useExpenses } from "@/lib/supabase/hooks/useExpenses";
import { useInvoices } from "@/lib/supabase/hooks/useInvoices";
import { useSupplierInvoices } from "@/lib/supabase/hooks/useSupplierInvoices";
import { useLedgerEntries } from "@/lib/supabase/hooks/useLedger";
import { useStockItems } from "@/lib/supabase/hooks/useStock";
import { inPeriod, type Period } from "@/lib/period";
import { fmt } from "@/lib/format";
import { BackLink } from "@/components/ui/BackLink";

export function CashFlowView() {
  const [period, setPeriod] = useState<Period>("month");
  const { data: income } = useIncome();
  const { data: expenses } = useExpenses();
  const { data: invoices } = useInvoices();
  const { data: supplierInvoices } = useSupplierInvoices();
  const { data: ledger } = useLedgerEntries();
  const { data: stock } = useStockItems();

  const within = inPeriod(period);

  const moneyIn = (income ?? []).filter((r) => within(r.transaction_date)).reduce((s, r) => s + Number(r.amount), 0);
  const moneyOut = (expenses ?? []).filter((r) => within(r.transaction_date)).reduce((s, r) => s + Number(r.amount), 0);
  const netCashFlow = moneyIn - moneyOut;

  // Receivables/payables are point-in-time (not period-filtered) — they represent
  // what's outstanding right now regardless of the period selector.
  const invoicesOwed = (invoices ?? [])
    .filter((i) => i.status !== "paid")
    .reduce((s, i) => s + Number(i.balance_due) + Number(i.vat_amount ?? 0), 0);
  const clientLedgerOwed = (ledger ?? [])
    .filter((e) => e.ledger_type === "client" && e.status !== "paid")
    .reduce((s, e) => s + Number(e.amount), 0);
  const owedToYou = invoicesOwed + clientLedgerOwed;

  const supplierInvoicesOwed = (supplierInvoices ?? [])
    .filter((si) => si.status !== "paid")
    .reduce((s, si) => s + Number(si.balance_due) + Number(si.vat_amount ?? 0), 0);
  const supplierLedgerOwed = (ledger ?? [])
    .filter((e) => e.ledger_type === "supplier" && e.status !== "paid")
    .reduce((s, e) => s + Number(e.amount), 0);
  const youOwe = supplierInvoicesOwed + supplierLedgerOwed;

  const adjustedPosition = netCashFlow + owedToYou - youOwe;
  const stockValue = (stock ?? []).reduce((s, item) => s + Number(item.cost_price || 0) * Number(item.qty || 0), 0);

  return (
    <div style={{ padding: "20px 16px 100px" }}>
      <BackLink />
      <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0C4A6E", margin: "4px 0 18px" }}>Cash Flow</h1>

      <PeriodSelector selected={period} onSelect={setPeriod} />

      <div style={{ background: "#0C4A6E", borderRadius: 16, padding: "18px 18px", marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>
          NET CASH FLOW
        </div>
        <div style={{ fontSize: 28, fontWeight: 800, color: netCashFlow >= 0 ? "#7DD3FC" : "#FCA5A5" }}>{fmt(netCashFlow)}</div>
        <div style={{ display: "flex", gap: 16, marginTop: 12 }}>
          <div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>IN</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#7DD3FC" }}>{fmt(moneyIn)}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>OUT</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#FCA5A5" }}>{fmt(moneyOut)}</div>
          </div>
        </div>
      </div>

      <div style={{ background: "#fff", borderRadius: 14, padding: "16px", marginBottom: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 12 }}>
          Adjusted position (incl. what&apos;s outstanding)
        </div>
        <Row label="Net cash flow" value={fmt(netCashFlow)} />
        <Row label="+ Owed to you" value={fmt(owedToYou)} color="#0369A1" />
        <Row label="− You owe suppliers" value={fmt(youOwe)} color="#b45309" />
        <div style={{ borderTop: "1.5px solid #e2e8f0", marginTop: 8, paddingTop: 8 }}>
          <Row label="Adjusted position" value={fmt(adjustedPosition)} bold />
        </div>
      </div>

      <div style={{ background: "#F0F9FF", borderRadius: 14, padding: "14px 16px", fontSize: 13, color: "#0369A1" }}>
        Stock on hand (at cost): <strong>{fmt(stockValue)}</strong>
        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>Not counted in cash position — value tied up in inventory.</div>
      </div>
    </div>
  );
}

function Row({ label, value, bold, color }: { label: string; value: string; bold?: boolean; color?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
      <span style={{ fontSize: 13, color: "#374151" }}>{label}</span>
      <span style={{ fontSize: bold ? 17 : 14, fontWeight: bold ? 800 : 600, color: color ?? "#0C4A6E" }}>{value}</span>
    </div>
  );
}
