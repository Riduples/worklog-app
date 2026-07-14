"use client";

import { useState } from "react";
import Link from "next/link";
import { useIncome } from "@/lib/supabase/hooks/useIncome";
import { useExpenses } from "@/lib/supabase/hooks/useExpenses";
import { useStockItems } from "@/lib/supabase/hooks/useStock";
import { IncomeModal } from "@/components/modals/IncomeModal";
import { ExpenseModal } from "@/components/modals/ExpenseModal";
import { QuickLogModal } from "@/components/modals/QuickLogModal";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { ToolTile } from "@/components/dashboard/ToolTile";
import { fmt, greeting } from "@/lib/format";
import type { Tables } from "@/lib/types/database";

const isThisMonth = (dateStr: string) => {
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
};

export function DashboardView({ businessName }: { businessName: string }) {
  const { data: income } = useIncome();
  const { data: expenses } = useExpenses();
  const { data: stock } = useStockItems();
  const [modal, setModal] = useState<"income" | "expense" | "quicklog" | null>(null);

  const monthIncome = (income ?? []).filter((r) => isThisMonth(r.transaction_date)).reduce((s, r) => s + Number(r.amount), 0);
  const monthExpense = (expenses ?? []).filter((r) => isThisMonth(r.transaction_date)).reduce((s, r) => s + Number(r.amount), 0);
  const profit = monthIncome - monthExpense;
  const taxJar = (income ?? []).reduce((s, r) => s + Number(r.tax_jar_amount || 0), 0);
  const lowStock = (stock ?? []).filter((s) => s.reorder_level != null && s.reorder_level > 0 && s.qty <= s.reorder_level);

  type Tx = (Tables<"income"> | Tables<"expenses">) & { txType: "income" | "expense" };
  const recentTx: Tx[] = [
    ...(income ?? []).map((r) => ({ ...r, txType: "income" as const })),
    ...(expenses ?? []).map((r) => ({ ...r, txType: "expense" as const })),
  ]
    .sort((a, b) => new Date(b.created_at ?? b.transaction_date).getTime() - new Date(a.created_at ?? a.transaction_date).getTime())
    .slice(0, 6);

  return (
    <div>
      <div style={{ background: "#1B4332", padding: "20px 20px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 900, color: "#fff", letterSpacing: 1.5 }}>WORKLOG</div>
            <div style={{ fontSize: 11, color: "#6EE7B7", letterSpacing: 0.3 }}>
              {greeting()}, {businessName || "there"}
            </div>
          </div>
          <LogoutButton />
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {[
            { label: "IN", value: fmt(monthIncome), color: "#6EE7B7" },
            { label: "OUT", value: fmt(monthExpense), color: "#FCA5A5" },
            { label: "PROFIT", value: fmt(profit), color: profit >= 0 ? "#6EE7B7" : "#FCA5A5" },
          ].map((s) => (
            <div key={s.label} style={{ flex: 1, background: "rgba(255,255,255,0.09)", borderRadius: 12, padding: "12px 10px" }}>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.5)", fontWeight: 700, letterSpacing: 1, marginBottom: 3 }}>
                {s.label}
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: "16px 16px 100px" }}>
        <button
          onClick={() => setModal("quicklog")}
          style={{
            width: "100%",
            background: "#F59E0B",
            borderRadius: 18,
            padding: "18px 16px",
            border: "none",
            color: "#fff",
            cursor: "pointer",
            textAlign: "left",
            marginBottom: 12,
            display: "flex",
            alignItems: "center",
            gap: 12,
            boxShadow: "0 4px 16px rgba(245,158,11,0.28)",
          }}
        >
          <span style={{ fontSize: 26 }}>✨</span>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>Quick Log</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.85)", marginTop: 1 }}>
              Type, speak, or snap a photo — WORKLOG logs it for you
            </div>
          </div>
        </button>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <button
            onClick={() => setModal("income")}
            style={{
              background: "#1B4332",
              borderRadius: 18,
              padding: "20px 16px",
              border: "none",
              color: "#fff",
              cursor: "pointer",
              textAlign: "left",
              boxShadow: "0 4px 16px rgba(27,67,50,0.22)",
            }}
          >
            <div style={{ fontSize: 28, marginBottom: 8 }}>💰</div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>Money In</div>
            <div style={{ fontSize: 12, color: "#A7F3D0", marginTop: 2 }}>Log income</div>
          </button>
          <button
            onClick={() => setModal("expense")}
            style={{
              background: "#fff",
              borderRadius: 18,
              padding: "20px 16px",
              border: "2px solid #d1fae5",
              color: "#1B4332",
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <div style={{ fontSize: 28, marginBottom: 8 }}>💸</div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>Money Out</div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>Log expense</div>
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
          <ToolTile href="/contacts" icon="👥" label="Contacts" />
          <ToolTile href="/stock" icon="📦" label="Stock" />
          <ToolTile href="/quotes" icon="📋" label="Quotes" />
          <ToolTile href="/invoices" icon="📤" label="Invoices" />
          <ToolTile href="/purchase-orders" icon="🛒" label="Purchase Orders" />
          <ToolTile href="/supplier-invoices" icon="📥" label="Supplier Invoices" />
          <ToolTile href="/recipes" icon="🍳" label="Cost Calculator" />
          <ToolTile href="/bookings" icon="📅" label="Bookings" />
          <ToolTile href="/time" icon="⏱️" label="Time Tracker" />
          <ToolTile href="/mileage" icon="🚗" label="Mileage" />
          <ToolTile href="/ledger" icon="📒" label="Ledgers" />
          <ToolTile href="/team" icon="👤" label="Team" />
        </div>

        <div style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1, margin: "6px 0 10px" }}>
          Reports
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
          <ToolTile href="/tax" icon="🧾" label="Tax & SARS" />
          <ToolTile href="/cashflow" icon="📊" label="Cash Flow" />
          <ToolTile href="/profit-loss" icon="📈" label="Profit & Loss" />
        </div>

        {lowStock.length > 0 && (
          <div
            style={{
              background: "#fff1f2",
              borderRadius: 14,
              padding: "13px 16px",
              marginBottom: 10,
              border: "1.5px solid #fecdd3",
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: "#be123c" }}>
              Low stock: {lowStock.map((s) => s.name).join(", ")}
            </div>
            <div style={{ fontSize: 12, color: "#9f1239" }}>
              <Link href="/stock" style={{ color: "inherit" }}>
                Tap to manage stock
              </Link>
            </div>
          </div>
        )}

        {taxJar > 0 && (
          <div
            style={{
              background: "#f0fdf4",
              borderRadius: 14,
              padding: "13px 16px",
              marginBottom: 10,
              border: "1.5px solid #bbf7d0",
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: "#1B4332" }}>Tax jar: {fmt(taxJar)}</div>
            <div style={{ fontSize: 12, color: "#166534" }}>Saved for SARS</div>
          </div>
        )}

        {recentTx.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>
              Recent
            </div>
            {recentTx.map((r) => (
              <div
                key={r.id}
                style={{
                  background: "#fff",
                  borderRadius: 13,
                  padding: "12px 14px",
                  marginBottom: 8,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: r.txType === "income" ? "#d1fae5" : "#fee2e2",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 17,
                    }}
                  >
                    {r.txType === "income" ? "💰" : "💸"}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#111" }}>
                      {r.what_for || (r.txType === "income" ? "Income" : "Expense")}
                    </div>
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>
                      {r.transaction_date} · {r.payment_method || ""}
                    </div>
                  </div>
                </div>
                <div style={{ fontWeight: 800, fontSize: 15, color: r.txType === "income" ? "#1B4332" : "#dc2626" }}>
                  {r.txType === "income" ? "+" : "-"}
                  {fmt(r.amount)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modal === "income" && <IncomeModal onClose={() => setModal(null)} />}
      {modal === "expense" && <ExpenseModal onClose={() => setModal(null)} />}
      {modal === "quicklog" && <QuickLogModal onClose={() => setModal(null)} />}
    </div>
  );
}
