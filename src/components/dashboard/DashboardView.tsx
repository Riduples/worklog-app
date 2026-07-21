"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useIncome } from "@/lib/supabase/hooks/useIncome";
import { useExpenses } from "@/lib/supabase/hooks/useExpenses";
import { useInvoices } from "@/lib/supabase/hooks/useInvoices";
import { useSupplierInvoices } from "@/lib/supabase/hooks/useSupplierInvoices";
import { useLedgerEntries } from "@/lib/supabase/hooks/useLedger";
import { useStockItems } from "@/lib/supabase/hooks/useStock";
import { IncomeModal } from "@/components/modals/IncomeModal";
import { ExpenseModal } from "@/components/modals/ExpenseModal";
import { QuickLogModal } from "@/components/modals/QuickLogModal";
import { UpgradeModal } from "@/components/modals/UpgradeModal";
import { HelpAssistantModal } from "@/components/modals/HelpAssistantModal";
import { BusinessDetailsModal } from "@/components/modals/BusinessDetailsModal";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { TrialStatusBar } from "@/components/billing/TrialStatusBar";
import { ToolTile } from "@/components/dashboard/ToolTile";
import { fmt, greeting } from "@/lib/format";
import { inPeriod } from "@/lib/period";
import { computePnl } from "@/lib/pnl";
import { useToolGate } from "@/lib/useToolGate";
import { type ToolId } from "@/lib/permissions";
import type { Tables } from "@/lib/types/database";


export function DashboardView({ businessName }: { businessName: string }) {
  const { data: income } = useIncome();
  const { data: expenses } = useExpenses();
  const { data: invoices } = useInvoices();
  const { data: supplierInvoices } = useSupplierInvoices();
  const { data: ledger } = useLedgerEntries();
  const { data: stock } = useStockItems();
  const [modal, setModal] = useState<"income" | "expense" | "quicklog" | "help" | "business" | null>(null);
  // requirePlanAccess() bounces someone off a page their plan doesn't include
  // and lands them here with ?upgrade=<tool>. Without this they'd arrive at the
  // dashboard with no idea why, which is worse than the hole it closes.
  const searchParams = useSearchParams();
  const upgradeParam = searchParams.get("upgrade");
  const [upgradeFeature, setUpgradeFeature] = useState<ToolId | "team" | null>(
    (upgradeParam as ToolId | "team" | null) ?? null
  );

  // Shared with the desktop sidebar, which has to reach exactly the same verdict
  // about every tool — see useToolGate.
  const { business, plan, isOwner, gate, tierLocked } = useToolGate();

  // The same "this month" Profit & Loss uses. This used to be a private
  // year-and-month check up at module scope, and the two screens disagreed:
  // inPeriod("month") had no upper bound and counted post-dated rows. Built per
  // render, not once at import — inPeriod reads the clock when you call it, so a
  // module-level predicate would still think it was whatever day the tab opened.
  const isThisMonth = inPeriod("month");

  // IN / OUT / PROFIT are this month on the same accrual, ex-VAT basis as the
  // Profit & Loss report — the very same computePnl — so the two screens can't
  // show a different profit for the same month. That means a supplier invoice or
  // a customer invoice counts here the moment it's recorded, not only when the
  // cash moves; Cash Flow is where the pure "what hit the account" view lives.
  const month = computePnl({ income, expenses, invoices, supplierInvoices, ledger }, isThisMonth);
  const monthIncome = month.revenue;
  const monthExpense = month.costs;
  const profit = month.profit;
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
      {/* On a phone this navy band IS the app's chrome. On a desktop the sidebar
          is, so the band would run into it and the logo would appear twice — the
          colours therefore live in globals.css, where a media query can reach
          them. An inline style can't be overridden by a class. */}
      <div className="dash-header">
        <div className="dash-header-row">
          <div>
            {/* The light variant: the logotype's own wordmark is #15171A, which
                lands at 1.90:1 on this navy — v65 ships that and it is close to
                unreadable. White is 9.46:1. The mark keeps its dark field.
                Hidden on desktop, where the sidebar already carries it.
                eslint-disable: next/image would want the dimensions plumbed
                through for a fixed-height brand asset that never reflows. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="dash-logo" src="/worklog-logo-light.png" alt="Worklog" />
            <div className="dash-greeting">
              {greeting()}, {businessName || "there"}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {isOwner && business && (
              <button onClick={() => setModal("business")} aria-label="Business details" className="dash-icon-btn">
                ⚙
              </button>
            )}
            {/* The word, not "?". A question mark only helps if you already know
                it means help — which is a poor assumption for the first person
                who opens this and doesn't know what the app can do. */}
            <button onClick={() => setModal("help")} className="dash-text-btn">
              Help
            </button>
            <LogoutButton />
          </div>
        </div>
        <div className="dash-stats">
          {[
            { label: "IN", value: fmt(monthIncome), color: "#7DD3FC" },
            { label: "OUT", value: fmt(monthExpense), color: "#FCA5A5" },
            { label: "PROFIT", value: fmt(profit), color: profit >= 0 ? "#7DD3FC" : "#FCA5A5" },
          ].map((s) => (
            <div key={s.label} className="dash-stat">
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.5)", fontWeight: 700, letterSpacing: 1, marginBottom: 3 }}>
                {s.label}
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      <TrialStatusBar />

      <div style={{ padding: "16px 16px 100px" }}>
        {(gate("income") || gate("expense")) && (
        <button
          onClick={() => setModal("quicklog")}
          className="dash-quicklog"
          style={{
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
              Type, speak, or snap a photo — Worklog logs it for you
            </div>
          </div>
        </button>
        )}

        <div className="money-grid">
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
              boxShadow: "0 4px 16px rgba(12,74,110,0.22)",
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

        <div className="tool-grid">
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
            <div className="tool-grid">
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
            <div className="tool-grid">
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
          isOwner={isOwner}
          onClose={() => setUpgradeFeature(null)}
        />
      )}
    </div>
  );
}
