"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useIncome } from "@/lib/supabase/hooks/useIncome";
import { useExpenses } from "@/lib/supabase/hooks/useExpenses";
import { useStockItems } from "@/lib/supabase/hooks/useStock";
import { useBusinessProfile } from "@/lib/supabase/hooks/useBusinessProfile";
import { useCurrentMember } from "@/lib/supabase/hooks/useCurrentMember";
import { IncomeModal } from "@/components/modals/IncomeModal";
import { ExpenseModal } from "@/components/modals/ExpenseModal";
import { QuickLogModal } from "@/components/modals/QuickLogModal";
import { UpgradeModal } from "@/components/modals/UpgradeModal";
import { HelpAssistantModal } from "@/components/modals/HelpAssistantModal";
import { BusinessDetailsModal } from "@/components/modals/BusinessDetailsModal";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { ToolTile } from "@/components/dashboard/ToolTile";
import { fmt, greeting } from "@/lib/format";
import { incomeNet } from "@/lib/taxRates";
import { canSee, type ToolId } from "@/lib/permissions";
import { coreToolsFor, isCoreTool } from "@/lib/businessTypes";
import { isLocked, type Plan } from "@/lib/tiers";
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
  const { data: business } = useBusinessProfile();
  const { data: currentMember } = useCurrentMember();
  const [modal, setModal] = useState<"income" | "expense" | "quicklog" | "help" | "business" | null>(null);
  // requirePlanAccess() bounces someone off a page their plan doesn't include
  // and lands them here with ?upgrade=<tool>. Without this they'd arrive at the
  // dashboard with no idea why, which is worse than the hole it closes.
  const searchParams = useSearchParams();
  const upgradeParam = searchParams.get("upgrade");
  const [upgradeFeature, setUpgradeFeature] = useState<ToolId | "team" | null>(
    (upgradeParam as ToolId | "team" | null) ?? null
  );

  // Default to full access while the membership row is still loading, so the
  // (overwhelmingly common) single-owner case never flashes hidden tiles.
  const member = currentMember ?? { role: "owner", permissions: {} };
  const plan = (business?.plan ?? "shoebox") as Plan;
  const isOwner = member.role === "owner";

  // Two independent filters, in the prototype's order: permission decides what
  // you're ALLOWED to see, business type decides what's WORTH showing you.
  // Type filtering hides rather than locks — a tool it removes is still fully
  // reachable by its URL and by turning on "Show every tool".
  const coreTools = coreToolsFor(business);
  const gate = (toolId: ToolId) => canSee(member, toolId) && isCoreTool(coreTools, toolId);
  const tierLocked = (toolId: ToolId) => isLocked(plan, toolId);

  // Net of VAT, so PROFIT is what the business actually earned rather than
  // being inflated by VAT it is only holding for SARS — and IN − OUT still
  // equals PROFIT. Cash Flow deliberately stays gross: it answers "what moved
  // through the account", which is a different question. Nothing changes for a
  // business that isn't VAT-registered (vat_amount is 0).
  const monthIncome = (income ?? []).filter((r) => isThisMonth(r.transaction_date)).reduce((s, r) => s + incomeNet(r), 0);
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
      <div style={{ background: "#0C4A6E", padding: "20px 20px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 900, color: "#fff", letterSpacing: 1.5 }}>WORKLOG</div>
            <div style={{ fontSize: 11, color: "#E0F2FE", letterSpacing: 0.3 }}>
              {greeting()}, {businessName || "there"}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {isOwner && business && (
              <button
                onClick={() => setModal("business")}
                aria-label="Business details"
                style={{ background: "rgba(255,255,255,0.12)", border: "none", borderRadius: 10, width: 34, height: 34, fontSize: 15, cursor: "pointer", color: "#fff" }}
              >
                ⚙
              </button>
            )}
            <button
              onClick={() => setModal("help")}
              aria-label="Help"
              style={{ background: "rgba(255,255,255,0.12)", border: "none", borderRadius: 10, width: 34, height: 34, fontSize: 15, cursor: "pointer", color: "#fff" }}
            >
              ?
            </button>
            <LogoutButton />
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {[
            { label: "IN", value: fmt(monthIncome), color: "#7DD3FC" },
            { label: "OUT", value: fmt(monthExpense), color: "#FCA5A5" },
            { label: "PROFIT", value: fmt(profit), color: profit >= 0 ? "#7DD3FC" : "#FCA5A5" },
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
        {(gate("income") || gate("expense")) && (
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
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          {gate("income") && (
          <button
            onClick={() => setModal("income")}
            style={{
              background: "#0C4A6E",
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
            <div style={{ fontSize: 12, color: "#E0F2FE", marginTop: 2 }}>Log income</div>
          </button>
          )}
          {gate("expense") && (
          <button
            onClick={() => setModal("expense")}
            style={{
              background: "#fff",
              borderRadius: 18,
              padding: "20px 16px",
              border: "2px solid #BAE6FD",
              color: "#0C4A6E",
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <div style={{ fontSize: 28, marginBottom: 8 }}>💸</div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>Money Out</div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>Log expense</div>
          </button>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
          {(gate("clients") || gate("suppliers")) && <ToolTile href="/contacts" icon="👥" label="Contacts" />}
          {gate("stock") && <ToolTile href="/stock" icon="📦" label="Stock" />}
          {gate("quote") && <ToolTile href="/quotes" icon="📋" label="Quotes" />}
          {gate("invoice") && <ToolTile href="/invoices" icon="📤" label="Invoices" />}
          {gate("statement") && (
            <ToolTile
              href="/statement"
              icon="📃"
              label="Statements"
              locked={tierLocked("statement")}
              onLockedClick={() => setUpgradeFeature("statement")}
            />
          )}
          {gate("bankstatement") && <ToolTile href="/bank-statement" icon="🏦" label="Import Statement" />}
          {gate("cashup") && <ToolTile href="/cash-up" icon="🧮" label="Daily Cash-Up" />}
          {gate("purchaseorder") && (
            <ToolTile
              href="/purchase-orders"
              icon="🛒"
              label="Purchase Orders"
              locked={tierLocked("purchaseorder")}
              onLockedClick={() => setUpgradeFeature("purchaseorder")}
            />
          )}
          {gate("supplierinvoice") && (
            <ToolTile
              href="/supplier-invoices"
              icon="📥"
              label="Supplier Invoices"
              locked={tierLocked("supplierinvoice")}
              onLockedClick={() => setUpgradeFeature("supplierinvoice")}
            />
          )}
          {gate("remittance") && (
            <ToolTile
              href="/remittance"
              icon="🧾"
              label="Remittance"
              locked={tierLocked("remittance")}
              onLockedClick={() => setUpgradeFeature("remittance")}
            />
          )}
          {gate("recipe") && <ToolTile href="/recipes" icon="🍳" label="Cost Calculator" />}
          {gate("booking") && <ToolTile href="/bookings" icon="📅" label="Bookings" />}
          {gate("timetrack") && <ToolTile href="/time" icon="⏱️" label="Time Tracker" />}
          {gate("mileage") && <ToolTile href="/mileage" icon="🚗" label="Mileage" />}
          {gate("ledger") && <ToolTile href="/ledger" icon="📒" label="Ledgers" />}
          {isOwner && <ToolTile href="/team" icon="👤" label="Team" />}
        </div>

        {(gate("staffregister") || gate("payrun") || gate("advances") || gate("leave")) && (
          <>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1, margin: "6px 0 10px" }}>
              Payroll
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
              {gate("staffregister") && (
                <ToolTile
                  href="/staff"
                  icon="👤"
                  label="Staff Register"
                  locked={tierLocked("staffregister")}
                  onLockedClick={() => setUpgradeFeature("staffregister")}
                />
              )}
              {gate("payrun") && (
                <ToolTile href="/payroll" icon="💵" label="Pay Run" locked={tierLocked("payrun")} onLockedClick={() => setUpgradeFeature("payrun")} />
              )}
              {gate("advances") && (
                <ToolTile href="/advances" icon="💰" label="Advances" locked={tierLocked("advances")} onLockedClick={() => setUpgradeFeature("advances")} />
              )}
              {gate("leave") && (
                <ToolTile href="/leave" icon="🏖️" label="Leave" locked={tierLocked("leave")} onLockedClick={() => setUpgradeFeature("leave")} />
              )}
            </div>
          </>
        )}

        {/* Guarded like Payroll above: a "Can log only" member has no report
            access at all, so this heading has always been able to render over
            an empty grid. Business-type filtering makes that easier to hit. */}
        {(gate("tax") || gate("profit") || gate("profitloss") || gate("ageanalysis")) && (
          <>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1, margin: "6px 0 10px" }}>
              Reports
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
              {gate("tax") && <ToolTile href="/tax" icon="🧾" label="Tax & SARS" />}
              {gate("profit") && <ToolTile href="/cashflow" icon="📊" label="Cash Flow" />}
              {gate("profitloss") && <ToolTile href="/profit-loss" icon="📈" label="Profit & Loss" />}
              {gate("ageanalysis") && (
                <ToolTile
                  href="/age-analysis"
                  icon="⏳"
                  label="Age Analysis"
                  locked={tierLocked("ageanalysis")}
                  onLockedClick={() => setUpgradeFeature("ageanalysis")}
                />
              )}
            </div>
          </>
        )}

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
              background: "#F0F9FF",
              borderRadius: 14,
              padding: "13px 16px",
              marginBottom: 10,
              border: "1.5px solid #BAE6FD",
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: "#0C4A6E" }}>Tax jar: {fmt(taxJar)}</div>
            <div style={{ fontSize: 12, color: "#0369A1" }}>Saved for SARS</div>
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
                      background: r.txType === "income" ? "#BAE6FD" : "#fee2e2",
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
                <div style={{ fontWeight: 800, fontSize: 15, color: r.txType === "income" ? "#0C4A6E" : "#dc2626" }}>
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
      {modal === "help" && <HelpAssistantModal onClose={() => setModal(null)} />}
      {modal === "business" && business && <BusinessDetailsModal business={business} onClose={() => setModal(null)} />}
      {upgradeFeature && business && (
        <UpgradeModal
          feature={upgradeFeature}
          currentPlan={plan}
          businessId={business.id}
          isOwner={isOwner}
          onClose={() => setUpgradeFeature(null)}
        />
      )}
    </div>
  );
}
