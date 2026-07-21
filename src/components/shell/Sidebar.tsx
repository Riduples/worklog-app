"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useToolGate } from "@/lib/useToolGate";
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

type Item = { tool: ToolId; href: string; icon: string; label: string };
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
      { tool: "stock", href: "/stock", icon: "📦", label: "Stock" },
      { tool: "recipe", href: "/recipes", icon: "🍳", label: "Cost Calculator" },
    ],
  },
  {
    title: "Purchases",
    items: [
      { tool: "purchaseorder", href: "/purchase-orders", icon: "🛒", label: "Purchase Orders" },
      { tool: "supplierinvoice", href: "/supplier-invoices", icon: "📥", label: "Supplier Invoices" },
      { tool: "remittance", href: "/remittance", icon: "🧾", label: "Remittance" },
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
      { tool: "booking", href: "/bookings", icon: "📅", label: "Bookings" },
      { tool: "timetrack", href: "/time", icon: "⏱️", label: "Time Tracker" },
      { tool: "mileage", href: "/mileage", icon: "🚗", label: "Mileage" },
    ],
  },
  {
    title: "Payroll",
    items: [
      { tool: "staffregister", href: "/staff", icon: "👤", label: "Staff Register" },
      { tool: "payrun", href: "/payroll", icon: "💵", label: "Pay Run" },
      { tool: "advances", href: "/advances", icon: "💰", label: "Advances" },
      { tool: "leave", href: "/leave", icon: "🏖️", label: "Leave" },
    ],
  },
  {
    title: "Tax & Reports",
    items: [
      { tool: "tax", href: "/tax", icon: "🧾", label: "Tax & SARS" },
      { tool: "profitloss", href: "/profit-loss", icon: "📈", label: "Profit & Loss" },
      { tool: "profit", href: "/cashflow", icon: "📊", label: "Cash Flow" },
      { tool: "ageanalysis", href: "/age-analysis", icon: "⏳", label: "Age Analysis" },
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

  return (
    <nav className="app-sidebar" style={{ background: "#0C4A6E", padding: "16px 10px 28px" }} aria-label="Main">
      <Link href="/dashboard" style={{ display: "block", padding: "0 9px 16px" }}>
        {/* The light variant: the logotype's own wordmark is near-black and all
            but vanishes on this navy. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/worklog-logo-light.png" alt="Worklog" style={{ height: 26, width: "auto", display: "block" }} />
      </Link>

      {navLink("/dashboard", "⌂", "Home", pathname === "/dashboard")}

      {GROUPS.map((group) => {
        const visible = group.items.filter((i) => gate(i.tool));
        // A group whose every tool is hidden by permission or business type
        // renders its heading over nothing — the same empty-heading trap the
        // dashboard guards against for Payroll and Reports.
        if (visible.length === 0) return null;
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
          {navLink("/accounts", "💳", "Bank accounts", isActive("/accounts"))}
          {navLink("/team", "👤", "Team", isActive("/team"))}
        </div>
      )}
    </nav>
  );
}
