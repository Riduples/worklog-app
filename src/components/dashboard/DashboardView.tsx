"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useIncome } from "@/lib/supabase/hooks/useIncome";
import { useExpenses } from "@/lib/supabase/hooks/useExpenses";
import { useInvoices } from "@/lib/supabase/hooks/useInvoices";
import { useSupplierInvoices } from "@/lib/supabase/hooks/useSupplierInvoices";
import { useLedgerEntries } from "@/lib/supabase/hooks/useLedger";
import { useStockItems } from "@/lib/supabase/hooks/useStock";
import { useBookings } from "@/lib/supabase/hooks/useBookings";
import { useBankAccounts } from "@/lib/supabase/hooks/useBankAccounts";
import { useAccountTransfers } from "@/lib/supabase/hooks/useAccountTransfers";
import { IncomeModal } from "@/components/modals/IncomeModal";
import { ExpenseModal } from "@/components/modals/ExpenseModal";
import { QuickLogModal } from "@/components/modals/QuickLogModal";
import { UpgradeModal } from "@/components/modals/UpgradeModal";
import { HelpAssistantModal } from "@/components/modals/HelpAssistantModal";
import { BusinessDetailsModal } from "@/components/modals/BusinessDetailsModal";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { TrialStatusBar } from "@/components/billing/TrialStatusBar";
import { useWriteAccess } from "@/lib/writeAccess";
import { ToolTile } from "@/components/dashboard/ToolTile";
import { BankAccountSelector, ALL_ACCOUNTS, type AccountFilter } from "@/components/ui/BankAccountSelector";
import { fmt, greeting, todayStr } from "@/lib/format";
import { inPeriod } from "@/lib/period";
import { computePnl } from "@/lib/pnl";
import { accountBalance } from "@/lib/accounts";
import { balanceInclVat } from "@/lib/balance";
import { useToolGate } from "@/lib/useToolGate";
import { type ToolId } from "@/lib/permissions";
import type { Tables } from "@/lib/types/database";

const sectionHead: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: 0.6,
  margin: "0 2px 9px",
};

export function DashboardView({ businessName }: { businessName: string }) {
  const { data: income } = useIncome();
  const { data: expenses } = useExpenses();
  const { data: invoices } = useInvoices();
  const { data: supplierInvoices } = useSupplierInvoices();
  const { data: ledger } = useLedgerEntries();
  const { data: stock } = useStockItems();
  const { data: bookings } = useBookings();
  const { data: accounts } = useBankAccounts();
  const { data: transfers } = useAccountTransfers();
  const [modal, setModal] = useState<"income" | "expense" | "quicklog" | "help" | "business" | null>(null);
  const [period, setPeriod] = useState<"month" | "year" | "all">("year");
  const [account, setAccount] = useState<AccountFilter>(ALL_ACCOUNTS);
  const [toolsOpen, setToolsOpen] = useState(false);
  // requirePlanAccess() bounces someone off a page their plan doesn't include
  // and lands them here with ?upgrade=<tool>. Without this they'd arrive at the
  // dashboard with no idea why, which is worse than the hole it closes.
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isReadOnly } = useWriteAccess();
  const upgradeParam = searchParams.get("upgrade");
  const [upgradeFeature, setUpgradeFeature] = useState<ToolId | "team" | null>(
    (upgradeParam as ToolId | "team" | null) ?? null
  );

  // Shared with the desktop sidebar, which has to reach exactly the same verdict
  // about every tool — see useToolGate.
  const { business, plan, isOwner, gate, tierLocked } = useToolGate();

  // The money hero. "Money left" over the chosen period is the accrual profit —
  // the same computePnl the Profit & Loss report uses, so the two can't disagree.
  // The toggle stays (a single month is too narrow for multi-month contracting),
  // and "in your accounts now" comes from the real bank balances.
  const within = inPeriod(period);
  const isAllAccounts = account === ALL_ACCOUNTS;
  const selectedAccount = (accounts ?? []).find((a) => a.id === account) ?? null;
  const pnl = computePnl({ income, expenses, invoices, supplierInvoices, ledger }, within);

  // A single account is a cash view: gross money that moved through it this period,
  // plus its running balance.
  const acctIn = (income ?? [])
    .filter((r) => r.account_id === account && within(r.transaction_date))
    .reduce((s, r) => s + Number(r.amount || 0), 0);
  const acctOut = (expenses ?? [])
    .filter((r) => r.account_id === account && within(r.transaction_date))
    .reduce((s, r) => s + Number(r.amount || 0), 0);
  const acctBalance = selectedAccount ? accountBalance(selectedAccount, income ?? [], expenses ?? [], transfers ?? []) : 0;
  const totalBalance = (accounts ?? []).reduce(
    (s, a) => s + accountBalance(a, income ?? [], expenses ?? [], transfers ?? []),
    0
  );
  const hasAccounts = (accounts ?? []).length > 0;

  const periodLabel = period === "month" ? "this month" : period === "year" ? "this year" : "all time";
  const heroLabel = isAllAccounts ? `Money left · ${periodLabel}` : `${selectedAccount?.name ?? "Account"} balance`;
  const heroFig = isAllAccounts ? pnl.profit : acctBalance;
  const heroIn = isAllAccounts ? pnl.revenue : acctIn;
  const heroOut = isAllAccounts ? pnl.costs : acctOut;

  const taxJar = (income ?? []).reduce((s, r) => s + Number(r.tax_jar_amount || 0), 0);
  const lowStock = (stock ?? []).filter((s) => s.reorder_level != null && s.reorder_level > 0 && s.qty <= s.reorder_level);

  // ── Needs you today ── the buildable three: overdue/unpaid invoices, today's
  // bookings, low stock — each gated on the same permission as its tool.
  const today = todayStr();
  const unpaidInvoices = gate("invoice") ? (invoices ?? []).filter((i) => i.status !== "paid") : [];
  const overdueTotal = unpaidInvoices
    .filter((i) => i.due_date && i.due_date < today)
    .reduce((s, i) => s + balanceInclVat(i.balance_due, i.vat_amount), 0);
  const unpaidTotal = unpaidInvoices.reduce((s, i) => s + balanceInclVat(i.balance_due, i.vat_amount), 0);
  const todaysBookings = gate("booking")
    ? (bookings ?? []).filter(
        (b) => b.booking_date === today && b.status !== "cancelled" && b.status !== "no_show" && b.status !== "completed"
      )
    : [];

  type Need = { key: string; icon: string; bg: string; title: string; sub: string; href: string };
  const needs: Need[] = [];
  if (unpaidInvoices.length > 0) {
    needs.push({
      key: "invoices",
      icon: "⚠️",
      bg: "#fee2e2",
      title: `${unpaidInvoices.length} unpaid invoice${unpaidInvoices.length === 1 ? "" : "s"}`,
      sub: overdueTotal > 0 ? `${fmt(overdueTotal)} overdue — tap to remind` : `${fmt(unpaidTotal)} outstanding`,
      href: "/invoices",
    });
  }
  for (const b of todaysBookings.slice(0, 3)) {
    needs.push({
      key: `booking-${b.id}`,
      icon: "📅",
      bg: "#BAE6FD",
      title: `${b.client_name}${b.booking_time ? ` — ${b.booking_time}` : ""}`,
      sub: b.service || "Appointment today",
      href: "/bookings",
    });
  }
  if (gate("stock") && lowStock.length > 0) {
    needs.push({
      key: "lowstock",
      icon: "📦",
      bg: "#fff7ed",
      title: `Low stock: ${lowStock.map((s) => s.name).slice(0, 3).join(", ")}`,
      sub: `${lowStock.length} item${lowStock.length === 1 ? "" : "s"} below reorder level`,
      href: "/stock",
    });
  }

  type Tx = (Tables<"income"> | Tables<"expenses">) & { txType: "income" | "expense" };
  const recentTx: Tx[] = [
    ...(income ?? []).map((r) => ({ ...r, txType: "income" as const })),
    ...(expenses ?? []).map((r) => ({ ...r, txType: "expense" as const })),
  ]
    .filter((t) => isAllAccounts || t.account_id === account)
    .sort((a, b) => new Date(b.created_at ?? b.transaction_date).getTime() - new Date(a.created_at ?? a.transaction_date).getTime())
    .slice(0, 6);
  const accountName = (id: string | null | undefined) => (accounts ?? []).find((a) => a.id === id)?.name ?? null;
  const showAccountTag = isAllAccounts && (accounts?.length ?? 0) >= 2;

  const heroPeriodBtn = (p: "month" | "year" | "all", label: string) => (
    <button
      key={p}
      onClick={() => setPeriod(p)}
      style={{
        background: period === p ? "rgba(255,255,255,0.22)" : "transparent",
        color: "#fff",
        border: "1px solid rgba(255,255,255,0.3)",
        borderRadius: 999,
        padding: "3px 11px",
        fontSize: 10,
        fontWeight: 800,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );

  return (
    <div>
      {/* On a phone this navy band IS the app's chrome. On a desktop the sidebar
          is, so the colours live in globals.css where a media query can reach them. */}
      <div className="dash-header">
        <div className="dash-header-row" style={{ marginBottom: 0 }}>
          <div>
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
            <button onClick={() => setModal("help")} className="dash-text-btn">
              Help
            </button>
            <LogoutButton />
          </div>
        </div>
      </div>

      <TrialStatusBar />

      <div style={{ padding: "16px 16px 100px" }}>
        {(accounts?.length ?? 0) >= 2 && <BankAccountSelector selected={account} onSelect={setAccount} />}

        {/* ── MONEY HERO ── */}
        <div className="dash-hero">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <div style={{ fontSize: 10.5, color: "#7DD3FC", fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5 }}>
              {heroLabel}
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              {heroPeriodBtn("month", "Month")}
              {heroPeriodBtn("year", "Year")}
              {heroPeriodBtn("all", "All")}
            </div>
          </div>
          <div style={{ fontSize: 38, fontWeight: 900, letterSpacing: -1.5, margin: "4px 0 2px", color: heroFig >= 0 ? "#fff" : "#fca5a5" }}>
            {fmt(heroFig)}
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            <div style={{ flex: 1, background: "rgba(255,255,255,0.1)", borderRadius: 10, padding: "9px 11px" }}>
              <div style={{ fontSize: 9, color: "#BAE6FD", fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.3 }}>In</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#7DD3FC", marginTop: 3 }}>{fmt(heroIn)}</div>
            </div>
            <div style={{ flex: 1, background: "rgba(255,255,255,0.1)", borderRadius: 10, padding: "9px 11px" }}>
              <div style={{ fontSize: 9, color: "#BAE6FD", fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.3 }}>Out</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#fca5a5", marginTop: 3 }}>{fmt(heroOut)}</div>
            </div>
          </div>
          {isAllAccounts && hasAccounts && (
            <Link
              href="/cashflow"
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, paddingTop: 11, borderTop: "1px solid rgba(255,255,255,0.14)", fontSize: 12, color: "#dceffb", textDecoration: "none" }}
            >
              <span>💳 In your accounts now</span>
              <span style={{ fontWeight: 800, color: "#fff" }}>{fmt(totalBalance)} ›</span>
            </Link>
          )}
        </div>

        {/* ── NEEDS YOU TODAY + LOG SOMETHING (two columns on desktop) ── */}
        <div className="dash-cols">
          <div>
            {needs.length > 0 ? (
              <div style={{ background: "#fff", border: "1px solid #eef0f3", borderRadius: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.05)", overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11, fontWeight: 800, color: "#92400e", textTransform: "uppercase", letterSpacing: 0.5, padding: "11px 14px 8px" }}>
                  ⚡ Needs you today
                </div>
                {needs.map((n, idx) => (
                  <Link
                    key={n.key}
                    href={n.href}
                    style={{ display: "flex", alignItems: "center", gap: 11, padding: "10px 14px", borderTop: idx === 0 ? "none" : "1px solid #f3f5f8", textDecoration: "none" }}
                  >
                    <div style={{ width: 30, height: 30, borderRadius: 9, background: n.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0 }}>
                      {n.icon}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#111" }}>{n.title}</div>
                      <div style={{ fontSize: 11, color: "#94a3b8" }}>{n.sub}</div>
                    </div>
                    <div style={{ color: "#cbd5e1", fontSize: 18 }}>›</div>
                  </Link>
                ))}
              </div>
            ) : (
              <div style={{ background: "#F0FDF4", border: "1px solid #bbf7d0", borderRadius: 16, padding: "16px", fontSize: 13, fontWeight: 700, color: "#166534", textAlign: "center" }}>
                ✅ Nothing needs you right now
              </div>
            )}
          </div>

          <div>
            <div style={sectionHead}>Log something</div>
            <div className="money-grid" style={{ marginBottom: 10 }}>
              {gate("income") && (
                <button
                  onClick={() => setModal("income")}
                  style={{ background: "#0C4A6E", borderRadius: 18, padding: "20px 16px", border: "none", color: "#fff", cursor: "pointer", textAlign: "left", boxShadow: "0 4px 16px rgba(12,74,110,0.22)" }}
                >
                  <div style={{ fontSize: 28, marginBottom: 8 }}>💰</div>
                  <div style={{ fontSize: 16, fontWeight: 800 }}>Money In</div>
                  <div style={{ fontSize: 12, color: "#E0F2FE", marginTop: 2 }}>Log income</div>
                </button>
              )}
              {gate("expense") && (
                <button
                  onClick={() => setModal("expense")}
                  style={{ background: "#fff", borderRadius: 18, padding: "20px 16px", border: "2px solid #BAE6FD", color: "#0C4A6E", cursor: "pointer", textAlign: "left" }}
                >
                  <div style={{ fontSize: 28, marginBottom: 8 }}>💸</div>
                  <div style={{ fontSize: 16, fontWeight: 800 }}>Money Out</div>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>Log expense</div>
                </button>
              )}
            </div>
            {(gate("income") || gate("expense")) && (
              <button
                onClick={() => (isReadOnly ? router.push("/billing/checkout") : setModal("quicklog"))}
                className="dash-quicklog"
                style={{ background: "#F59E0B", borderRadius: 18, padding: "16px", border: "none", color: "#fff", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 4px 16px rgba(245,158,11,0.28)" }}
              >
                <span style={{ fontSize: 24 }}>✨</span>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800 }}>Just tell me</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.85)", marginTop: 1 }}>Type, talk or snap — Worklog logs it</div>
                </div>
              </button>
            )}
          </div>
        </div>

        {/* ── ALL MY TOOLS (collapsed on mobile, hidden on desktop — the sidebar is the tool list) ── */}
        <div className="dash-tools" style={{ marginTop: 16 }}>
          <button
            onClick={() => setToolsOpen((o) => !o)}
            style={{ width: "100%", background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 14, padding: "13px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}
          >
            <span>
              <span style={{ display: "block", fontSize: 13, fontWeight: 800, color: "#0C4A6E" }}>All my tools</span>
              <span style={{ display: "block", fontSize: 11, color: "#94a3b8", marginTop: 2 }}>Quotes, invoices, stock, staff, tax &amp; more</span>
            </span>
            <span style={{ fontSize: 22, color: "#0C4A6E", transform: toolsOpen ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}>▸</span>
          </button>

          {toolsOpen && (
            <div style={{ marginTop: 12 }}>
              <div className="tool-grid">
                {(gate("clients") || gate("suppliers")) && <ToolTile href="/contacts" icon="👥" label="Contacts" />}
                {gate("stock") && <ToolTile href="/stock" icon="📦" label="Stock" />}
                {gate("quote") && <ToolTile href="/quotes" icon="📋" label="Quotes" />}
                {gate("invoice") && <ToolTile href="/invoices" icon="📤" label="Invoices" />}
                {gate("statement") && (
                  <ToolTile href="/statement" icon="📃" label="Statements" locked={tierLocked("statement")} onLockedClick={() => setUpgradeFeature("statement")} />
                )}
                {gate("bankstatement") && <ToolTile href="/bank-statement" icon="🏦" label="Import Statement" />}
                {gate("cashup") && <ToolTile href="/cash-up" icon="🧮" label="Daily Cash-Up" />}
                {isOwner && <ToolTile href="/accounts" icon="💳" label="Bank Accounts" />}
                {gate("purchaseorder") && (
                  <ToolTile href="/purchase-orders" icon="🛒" label="Purchase Orders" locked={tierLocked("purchaseorder")} onLockedClick={() => setUpgradeFeature("purchaseorder")} />
                )}
                {gate("supplierinvoice") && (
                  <ToolTile href="/supplier-invoices" icon="📥" label="Supplier Invoices" locked={tierLocked("supplierinvoice")} onLockedClick={() => setUpgradeFeature("supplierinvoice")} />
                )}
                {gate("remittance") && (
                  <ToolTile href="/remittance" icon="🧾" label="Remittance" locked={tierLocked("remittance")} onLockedClick={() => setUpgradeFeature("remittance")} />
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
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1, margin: "14px 0 10px" }}>Payroll</div>
                  <div className="tool-grid">
                    {gate("staffregister") && (
                      <ToolTile href="/staff" icon="👤" label="Staff Register" locked={tierLocked("staffregister")} onLockedClick={() => setUpgradeFeature("staffregister")} />
                    )}
                    {gate("payrun") && <ToolTile href="/payroll" icon="💵" label="Pay Run" locked={tierLocked("payrun")} onLockedClick={() => setUpgradeFeature("payrun")} />}
                    {gate("advances") && <ToolTile href="/advances" icon="💰" label="Advances" locked={tierLocked("advances")} onLockedClick={() => setUpgradeFeature("advances")} />}
                    {gate("leave") && <ToolTile href="/leave" icon="🏖️" label="Leave" locked={tierLocked("leave")} onLockedClick={() => setUpgradeFeature("leave")} />}
                  </div>
                </>
              )}

              {(gate("tax") || gate("profit") || gate("profitloss") || gate("ageanalysis")) && (
                <>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1, margin: "14px 0 10px" }}>Reports</div>
                  <div className="tool-grid">
                    {gate("tax") && <ToolTile href="/tax" icon="🧾" label="Tax & SARS" />}
                    {gate("profit") && <ToolTile href="/cashflow" icon="📊" label="Cash Flow" />}
                    {gate("profitloss") && <ToolTile href="/profit-loss" icon="📈" label="Profit & Loss" />}
                    {gate("ageanalysis") && (
                      <ToolTile href="/age-analysis" icon="⏳" label="Age Analysis" locked={tierLocked("ageanalysis")} onLockedClick={() => setUpgradeFeature("ageanalysis")} />
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {taxJar > 0 && (
          <div style={{ background: "#F0F9FF", borderRadius: 14, padding: "13px 16px", marginTop: 12, border: "1.5px solid #BAE6FD" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#0C4A6E" }}>Tax jar: {fmt(taxJar)}</div>
            <div style={{ fontSize: 12, color: "#0369A1" }}>Set aside for SARS</div>
          </div>
        )}

        {recentTx.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Recent</div>
            {recentTx.map((r) => (
              <div
                key={r.id}
                style={{ background: "#fff", borderRadius: 13, padding: "12px 14px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: r.txType === "income" ? "#BAE6FD" : "#fee2e2", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17 }}>
                    {r.txType === "income" ? "💰" : "💸"}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#111" }}>
                      {r.what_for || (r.txType === "income" ? "Income" : "Expense")}
                    </div>
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>
                      {r.transaction_date} · {r.payment_method || ""}
                      {showAccountTag && accountName(r.account_id) ? ` · ${accountName(r.account_id)}` : ""}
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
        <UpgradeModal feature={upgradeFeature} currentPlan={plan} isOwner={isOwner} onClose={() => setUpgradeFeature(null)} />
      )}
    </div>
  );
}
