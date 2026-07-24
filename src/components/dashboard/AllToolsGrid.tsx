"use client";

import { useState } from "react";
import { ToolTile } from "@/components/dashboard/ToolTile";
import { useToolGate } from "@/lib/useToolGate";
import { TOOL_CATEGORIES, type ToolId } from "@/lib/permissions";

// The full, permission- and business-type-gated tool list. Shared by the
// dashboard's "All my tools" and the mobile tab bar's "More" sheet so the two can
// never drift. A locked tile hands its tool id back via onLockedClick — the
// dashboard opens its UpgradeModal, the tab bar routes to /dashboard?upgrade=.
//
// Tools are grouped under the same TOOL_CATEGORIES the Team permissions editor
// uses, rendered as expandable cards: a main name (Price List, Contacts, Sales,
// …) with its tools revealed underneath. The card header (icon/label/desc) is
// pulled from TOOL_CATEGORIES by id so it can't drift from the permissions model;
// only the per-tool navigation (route, tier-lock) lives here.

// Header text for each card, keyed by category id — the single source of truth
// for the group name and description shown on the collapsed card.
const CAT = Object.fromEntries(TOOL_CATEGORIES.map((c) => [c.id, c])) as Record<
  string,
  (typeof TOOL_CATEGORIES)[number]
>;

type NavItem = {
  href: string;
  icon: string;
  label: string;
  // How the item earns its place in the list:
  toolId?: ToolId; // visible when this tool's permission gate passes
  anyOf?: ToolId[]; // visible when ANY of these gates pass (one page, many perms)
  ownerOnly?: boolean; // visible to owners only (no per-tool permission)
  lockId?: ToolId; // when set, tile locks (and prompts upgrade) if the plan lacks it
};

// Category id → its navigable tools, in display order. Same set of tools and
// routes the flat grid shipped before — just organised under the category cards.
const NAV_CATEGORIES: { id: string; items: NavItem[] }[] = [
  {
    id: "stock", // Price List
    items: [
      { href: "/stock", icon: "📦", label: "Stock", toolId: "stock" },
      { href: "/recipes", icon: "🍳", label: "Cost Calculator", toolId: "recipe" },
    ],
  },
  {
    id: "contacts", // Contacts
    items: [{ href: "/contacts", icon: "👥", label: "Contacts", anyOf: ["clients", "suppliers"] }],
  },
  {
    id: "invoicing", // Sales
    items: [
      { href: "/quotes", icon: "📋", label: "Quotes", toolId: "quote" },
      { href: "/invoices", icon: "📤", label: "Invoices", toolId: "invoice" },
      { href: "/statement", icon: "📃", label: "Statements", toolId: "statement", lockId: "statement" },
    ],
  },
  {
    id: "purchases", // Purchases
    items: [
      { href: "/purchase-orders", icon: "🛒", label: "Purchase Orders", toolId: "purchaseorder", lockId: "purchaseorder" },
      { href: "/supplier-invoices", icon: "📥", label: "Supplier Invoices", toolId: "supplierinvoice", lockId: "supplierinvoice" },
      { href: "/remittance", icon: "🧾", label: "Remittance", toolId: "remittance", lockId: "remittance" },
    ],
  },
  {
    id: "bookings", // Scheduling System
    items: [
      { href: "/bookings", icon: "📅", label: "Bookings", toolId: "booking" },
      { href: "/time", icon: "⏱️", label: "Time Tracker", toolId: "timetrack" },
      { href: "/mileage", icon: "🚗", label: "Mileage", toolId: "mileage" },
    ],
  },
  {
    id: "workers", // Payroll
    items: [
      { href: "/staff", icon: "👤", label: "Staff Register", toolId: "staffregister", lockId: "staffregister" },
      { href: "/payroll", icon: "💵", label: "Pay Run", toolId: "payrun", lockId: "payrun" },
      { href: "/advances", icon: "💰", label: "Advances", toolId: "advances", lockId: "advances" },
      { href: "/leave", icon: "🏖️", label: "Leave", toolId: "leave", lockId: "leave" },
    ],
  },
  {
    id: "money", // Money
    items: [
      { href: "/bank-statement", icon: "🏦", label: "Import Statement", toolId: "bankstatement" },
      { href: "/cash-up", icon: "🧮", label: "Daily Cash-Up", toolId: "cashup" },
      { href: "/ledger", icon: "📒", label: "Ledgers", toolId: "ledger" },
    ],
  },
  {
    id: "taxcompliance", // Tax & Compliance
    items: [
      { href: "/tax", icon: "🧾", label: "Tax & SARS", toolId: "tax" },
      { href: "/cashflow", icon: "📊", label: "Cash Flow", toolId: "profit" },
      { href: "/profit-loss", icon: "📈", label: "Profit & Loss", toolId: "profitloss" },
      { href: "/age-analysis", icon: "⏳", label: "Age Analysis", toolId: "ageanalysis", lockId: "ageanalysis" },
    ],
  },
];

export function AllToolsGrid({ onLockedClick }: { onLockedClick: (tool: ToolId) => void }) {
  const { isOwner, gate, tierLocked } = useToolGate();
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const isVisible = (it: NavItem) =>
    it.ownerOnly ? isOwner : it.anyOf ? it.anyOf.some(gate) : it.toolId ? gate(it.toolId) : true;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {NAV_CATEGORIES.map(({ id, items }) => {
        const cat = CAT[id];
        const shown = items.filter(isVisible);
        // A card with nothing the member may open would just be a dead heading.
        if (!cat || shown.length === 0) return null;
        const isOpen = !!open[id];
        return (
          <div key={id} style={{ background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
            <button
              type="button"
              onClick={() => setOpen((p) => ({ ...p, [id]: !p[id] }))}
              aria-expanded={isOpen}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", background: isOpen ? "#F0F9FF" : "#fff", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}
            >
              <span style={{ fontSize: 26, flexShrink: 0 }}>{cat.icon}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 15, fontWeight: 800, color: "#0C4A6E" }}>{cat.label}</span>
                <span style={{ display: "block", fontSize: 11.5, color: "#94a3b8", marginTop: 2 }}>{cat.desc}</span>
              </span>
              <span style={{ fontSize: 18, color: isOpen ? "#0C4A6E" : "#94a3b8", flexShrink: 0, transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>▾</span>
            </button>

            {isOpen && (
              <div style={{ padding: "12px", background: "#F8FAFC", borderTop: "1px solid #e2e8f0" }}>
                <div className="tool-grid" style={{ marginBottom: 0 }}>
                  {shown.map((it) => (
                    <ToolTile
                      key={it.href + it.label}
                      href={it.href}
                      icon={it.icon}
                      label={it.label}
                      locked={it.lockId ? tierLocked(it.lockId) : undefined}
                      onLockedClick={it.lockId ? () => onLockedClick(it.lockId as ToolId) : undefined}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
