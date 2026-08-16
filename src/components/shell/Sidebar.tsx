"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useToolGate } from "@/lib/useToolGate";
import { useLogModal } from "@/components/providers/LogModalProvider";
import type { ToolId } from "@/lib/permissions";

// Desktop navigation.
//
// On a phone the app is hub-and-spoke: dashboard, tile, tool, back. That suits
// a thumb and one job at a time. On a desktop it means every trip goes through
// the dashboard, which is the thing that made the app feel like a phone stranded
// in a browser more than the width did.
//
// Rendered only at >=1024px, and by CSS rather than by measuring the viewport in
// JS — see globals.css. It gates through useToolGate, the same hook the
// dashboard tiles use, so the two can't offer different tools.

type Item = { tool: ToolId; anyOf?: ToolId[]; href: string; icon: string; label: string };
type Group = { title: string; items: Item[] };

// Mirrors the dashboard's grouping, with one difference: the dashboard leads
// with Money In/Out as big buttons because they're actions. Here they're
// destinations like everything else.
const GROUPS: Group[] = [
  {
    title: "Sales",
    items: [
      { tool: "quote", href: "/quotes", icon: "📋", label: "Quotes" },
      { tool: "invoice", href: "/invoices", icon: "📤", label: "Invoices" },
      { tool: "statement", href: "/statement", icon: "📃", label: "Statements" },
      { tool: "ageanalysis", href: "/age-analysis", icon: "⏳", label: "Age Analysis" },
      { tool: "invoice", anyOf: ["invoice", "quote"], href: "/sales-reports", icon: "📊", label: "Sales Reports" },
      { tool: "stock", href: "/stock", icon: "📦", label: "Items" },
      { tool: "recipe", href: "/recipes", icon: "🍳", label: "Cost Calculator" },
      { tool: "stock", anyOf: ["stock", "recipe"], href: "/price-list-reports", icon: "📊", label: "Price List Reports" },
    ],
  },
  {
    title: "Purchases",
    items: [
      { tool: "purchaseorder", href: "/purchase-orders", icon: "🛒", label: "Purchase Orders" },
      { tool: "supplierinvoice", href: "/supplier-invoices", icon: "📥", label: "Supplier Invoices" },
      { tool: "remittance", href: "/remittance", icon: "🧾", label: "Remittance" },
      { tool: "payables", href: "/age-analysis-payables", icon: "⏳", label: "Age Analysis" },
      { tool: "supplierinvoice", anyOf: ["supplierinvoice", "purchaseorder", "expense"], href: "/purchases-reports", icon: "📊", label: "Purchases Reports" },
    ],
  },
  {
    title: "Money",
    items: [
      { tool: "bankstatement", href: "/bank-statement", icon: "🏦", label: "Import Statement" },
      { tool: "cashup", href: "/cash-up", icon: "🧮", label: "Daily Cash-Up" },
      { tool: "ledger", href: "/ledger", icon: "📒", label: "Ledgers" },
    ],
  },
  {
    title: "Work",
    items: [
      { tool: "booking", href: "/diary", icon: "📅", label: "Diary" },
      { tool: "timetrack", href: "/time", icon: "⏱️", label: "Time Log" },
      { tool: "mileage", href: "/mileage", icon: "🚗", label: "Travel Log" },
      { tool: "booking", anyOf: ["booking", "timetrack", "mileage"], href: "/time-travel-reports", icon: "📊", label: "Scheduling Reports" },
    ],
  },
  {
    title: "Payroll",
    items: [
      { tool: "staffregister", href: "/staff", icon: "👤", label: "Staff Register" },
      { tool: "payrun", href: "/payroll", icon: "💵", label: "Pay Run" },
      { tool: "advances", href: "/advances", icon: "💰", label: "Advances" },
      { tool: "leave", href: "/leave", icon: "🏖️", label: "Leave" },
      { tool: "staffregister", anyOf: ["staffregister", "advances", "leave"], href: "/payroll-reports", icon: "📊", label: "Payroll Reports" },
      { tool: "payrollcompliance", href: "/payroll-compliance", icon: "📋", label: "Payroll Compliance" },
    ],
  },
  {
    title: "Compliance & Financials",
    items: [
      { tool: "tax", href: "/tax", icon: "🧾", label: "Tax & SARS" },
      { tool: "profitloss", href: "/profit-loss", icon: "📈", label: "Profit & Loss" },
      { tool: "profit", href: "/cashflow", icon: "📊", label: "Cash Flow" },
    ],
  },
];

const linkBase: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "7px 9px",
  borderRadius: 8,
  fontSize: 13,
  textDecoration: "none",
  lineHeight: 1.4,
};

export function Sidebar() {
  const pathname = usePathname();
  const { gate, tierLocked, isOwner } = useToolGate();
  const { openLog } = useLogModal();

  // Onboarding has no business yet, so a nav full of that business's tools would
  // be answering a question the owner hasn't been asked. Checkout is a single
  // decision and doesn't want an escape hatch beside it either.
  if (pathname === "/onboarding" || pathname.startsWith("/billing")) return null;

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const navLink = (href: string, icon: string, label: string, active: boolean) => (
    <Link
      key={href}
      href={href}
      style={{
        ...linkBase,
        background: active ? "rgba(255,255,255,0.14)" : "transparent",
        color: active ? "#fff" : "#E0F2FE",
        fontWeight: active ? 700 : 500,
      }}
    >
      <span style={{ fontSize: 14 }}>{icon}</span>
      <span>{label}</span>
    </Link>
  );

  // The one and only way into the structured Income/Expense forms now that the
  // dashboard's big Money In/Out buttons are gone — a button, not a link, because
  // there's no page to point at: it opens the modal via the shared LogModalProvider.
  const logNavButton = (kind: "income" | "expense", icon: string, label: string) => (
    <button
      key={`log-${kind}`}
      type="button"
      onClick={() => openLog(kind)}
      style={{ ...linkBase, width: "100%", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left", color: "#E0F2FE", fontWeight: 500 }}
    >
      <span style={{ fontSize: 14 }}>{icon}</span>
      <span>{label}</span>
    </button>
  );

  return (
    <nav className="app-sidebar" style={{ background: "#0C4A6E", padding: "16px 10px 28px" }} aria-label="Main">
      <Link href="/dashboard" style={{ display: "block", padding: "0 9px 16px" }}>
        {/* The light variant: the logotype's own wordmark is near-black and all
            but vanishes on this navy. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/worklog-logo-light.png" alt="Worklog" style={{ height: 26, width: "auto", display: "block" }} />
      </Link>

      {navLink("/dashboard", "⌂", "Home", pathname === "/dashboard")}
      {/* Customers and Suppliers are two tools over one contacts table; each
          sits above the groups and gates on its own permission — they're the
          tools the dashboard grid carried that the sidebar didn't, which
          matters now the grid is hidden on desktop. */}
      {gate("clients") && navLink("/customers", "👤", "Customers", isActive("/customers"))}
      {gate("suppliers") && navLink("/suppliers", "🏬", "Suppliers", isActive("/suppliers"))}
      {(gate("clients") || gate("suppliers")) && navLink("/contacts-reports", "📊", "Contacts Reports", isActive("/contacts-reports"))}

      {GROUPS.map((group) => {
        const visible = group.items.filter((i) => (i.anyOf ? i.anyOf.some(gate) : gate(i.tool)));
        // Log income / Log expense sit under the Money tools, at the foot of the group.
        const isMoney = group.title === "Money";
        const showLogs = isMoney && (gate("income") || gate("expense"));
        // A group whose every tool is hidden by permission or business type
        // renders its heading over nothing — the same empty-heading trap the
        // dashboard guards against for Payroll and Reports.
        if (visible.length === 0 && !showLogs) return null;
        return (
          <div key={group.title}>
            <div
              style={{
                fontSize: 9,
                fontWeight: 700,
                color: "rgba(255,255,255,0.42)",
                letterSpacing: 0.8,
                textTransform: "uppercase",
                padding: "14px 9px 5px",
              }}
            >
              {group.title}
            </div>
            {visible.map((item) =>
              tierLocked(item.tool) ? (
                // Locked tools stay visible — the upsell is the point — and hand
                // off to the dashboard's existing UpgradeModal via ?upgrade=,
                // the same route requirePlanAccess() uses when it bounces
                // someone off a page their plan doesn't include.
                <Link
                  key={item.href}
                  href={`/dashboard?upgrade=${item.tool}`}
                  style={{ ...linkBase, color: "rgba(255,255,255,0.38)", fontWeight: 500 }}
                >
                  <span style={{ fontSize: 14 }}>🔒</span>
                  <span>{item.label}</span>
                </Link>
              ) : (
                navLink(item.href, item.icon, item.label, isActive(item.href))
              )
            )}
            {isMoney && gate("income") && logNavButton("income", "💰", "Log income")}
            {isMoney && gate("expense") && logNavButton("expense", "💸", "Log expense")}
          </div>
        );
      })}

      {isOwner && (
        <div>
          <div
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: "rgba(255,255,255,0.42)",
              letterSpacing: 0.8,
              textTransform: "uppercase",
              padding: "14px 9px 5px",
            }}
          >
            Business
          </div>
          {navLink("/business", "🏢", "Business Hub", isActive("/business") || isActive("/accounts") || isActive("/team"))}
        </div>
      )}

      {/* Help Centre — a real, highlighted destination rather than a dim footer
          word, so it's actually findable. Terms/Privacy stay as the quiet footer. */}
      <Link
        href="/help"
        style={{ ...linkBase, marginTop: 16, background: "rgba(255,255,255,0.10)", color: "#fff", fontWeight: 700 }}
      >
        <span style={{ fontSize: 14 }}>❓</span>
        <span>Help Centre</span>
      </Link>

      <div style={{ padding: "16px 9px 0", fontSize: 10.5, color: "rgba(255,255,255,0.4)" }}>
        <Link href="/terms" style={{ color: "rgba(255,255,255,0.55)", textDecoration: "none" }}>Terms</Link>
        <span style={{ margin: "0 6px" }}>·</span>
        <Link href="/privacy" style={{ color: "rgba(255,255,255,0.55)", textDecoration: "none" }}>Privacy</Link>
      </div>
    </nav>
  );
}
