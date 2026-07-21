// Subscription tiers — the paid-only three-tier model (pricing redesign Phase 1).
// Solo / Trade / Structured. All prices are VAT-inclusive ZAR.
//
// Real billing is wired: PayFast checkout + ITN (src/lib/payfast.ts, the notify
// route) write the subscriptions table, and a trigger syncs business_profiles.plan
// from it (migration 0054/0065). "plan" is no longer a manual flag.
//
// Two layers gate features. ENTITLEMENTS below is the CLIENT courtesy layer,
// checked by CAPABILITY (hasStaffTools, hasComplianceTools, …) rather than by
// tier name, so a price or tier rename doesn't ripple through every component.
// The real authority is Postgres RLS — plan_allows() and the member-cap function
// (migration 0065) — which mirror this file inverted. Keep the two in step: this
// is the courtesy, the DB is the authority.

import type { ToolId } from "@/lib/permissions";

export type Plan = "solo" | "trade" | "structured";

export const PLAN_ORDER: Plan[] = ["solo", "trade", "structured"];

// Single source of truth for price. The number is VAT-inclusive ZAR — the amount
// PayFast bills and the ITN validates against; the "R79/mo" strings below are its
// display. An amount the gateway charges that disagrees with the price shown is
// the drift that ends in a chargeback, so both come from here.
export const PLAN_PRICE_ZAR: Record<Plan, number> = { solo: 79, trade: 149, structured: 229 };

const priceLabel = (plan: Plan) => `R${PLAN_PRICE_ZAR[plan]}/mo`;

export const TIERS: Record<Plan, { label: string; price: string; badge?: string; color: string; bg: string; border: string }> = {
  solo: { label: "Solo", price: priceLabel("solo"), color: "#0C4A6E", bg: "#F0F9FF", border: "#7DD3FC" },
  // Trade is the "Most popular" tier — brand orange (#E8A33D) on the pricing card.
  trade: { label: "Trade", price: priceLabel("trade"), badge: "Most popular", color: "#B45309", bg: "#FFFBEB", border: "#E8A33D" },
  structured: { label: "Structured", price: priceLabel("structured"), color: "#1e40af", bg: "#eff6ff", border: "#bfdbfe" },
};

// What each plan is sold as. Shared so the signup picker, the upgrade prompt and
// the checkout summary can't describe the same plan three different ways. Keep
// these honest against the entitlements/lock lists below.
export const PLAN_FEATURES: Record<Plan, { tagline: string; features: string[] }> = {
  solo: {
    tagline: "Your money, organised",
    features: [
      "Log income & expenses in seconds",
      "Quick Log — type, speak or snap a photo",
      "Daily cash-up, quotes & invoices",
      "Snap & save receipts",
      "Monthly summary & VAT threshold alerts",
    ],
  },
  trade: {
    tagline: "Your money, growing",
    features: [
      "Everything in Solo",
      "Up to 5 staff logins with permission controls",
      "Staff register & full payroll — PAYE, UIF & SDL",
      "Purchase orders, supplier invoices & statements",
      "Age analysis & tax-ready reports",
    ],
  },
  structured: {
    tagline: "Your money, controlled",
    features: [
      "Everything in Trade",
      "Unlimited staff logins",
      "VAT201 & EMP201 tracking",
      "Provisional tax & compliance dashboard",
      "Accountant pack — ledger, trial balance & VAT figures",
    ],
  },
};

// Capability-based entitlements, derived from the tier. Components check these
// (hasStaffTools, hasComplianceTools, …) rather than the tier name. maxMembers
// counts total business_members INCLUDING the owner: Solo owner-only (1), Trade
// owner + up to 5 (6), Structured unlimited (null). The trust indicator, tax-ready
// reports, funding pack and accountant-pack flags are declared here for the carve
// even though their features land later — an inert flag no UI reads yet.
export type Entitlements = {
  maxMembers: number | null; // null = unlimited
  hasStaffTools: boolean; // staff register + payroll (staffregister/payrun/advances/leave)
  hasBuyingDocs: boolean; // purchase orders, supplier invoices, remittances, statements
  hasRecurringInvoices: boolean;
  hasAgeAnalysis: boolean;
  hasComplianceTools: boolean; // vat201, emp201, provtax, compliance dashboard
  hasAccountantPack: boolean; // ledger, trial balance, VAT figures (net-new)
  hasTrustIndicator: boolean; // receipt trust indicator (net-new)
  hasTaxReadyReports: boolean; // net-new
  hasFundingPack: boolean; // funding application pack (net-new)
};

export const ENTITLEMENTS: Record<Plan, Entitlements> = {
  solo: {
    maxMembers: 1,
    hasStaffTools: false,
    hasBuyingDocs: false,
    hasRecurringInvoices: false,
    hasAgeAnalysis: false,
    hasComplianceTools: false,
    hasAccountantPack: false,
    hasTrustIndicator: false,
    hasTaxReadyReports: false,
    hasFundingPack: false,
  },
  trade: {
    maxMembers: 6,
    hasStaffTools: true,
    hasBuyingDocs: true,
    hasRecurringInvoices: true,
    hasAgeAnalysis: true,
    hasComplianceTools: false,
    hasAccountantPack: false,
    hasTrustIndicator: true,
    hasTaxReadyReports: true,
    hasFundingPack: true,
  },
  structured: {
    maxMembers: null,
    hasStaffTools: true,
    hasBuyingDocs: true,
    hasRecurringInvoices: true,
    hasAgeAnalysis: true,
    hasComplianceTools: true,
    hasAccountantPack: true,
    hasTrustIndicator: true,
    hasTaxReadyReports: true,
    hasFundingPack: true,
  },
};

export const entitlementsFor = (plan: Plan): Entitlements => ENTITLEMENTS[plan] ?? ENTITLEMENTS.solo;

// Tools locked below Structured — the tax/compliance suite + accountant pack.
export const STRUCTURED_ONLY: ToolId[] = ["vat201", "emp201", "provtax", "compliance"];

// Tools locked on Solo — everything that needs Trade or Structured: staff &
// payroll, buying-side documents, age analysis, recurring invoices, team logins,
// plus everything Structured-only. This is the inverse of the Solo entitlements.
export const TRADE_PLUS: (ToolId | "team" | "invoice_recurring")[] = [
  "staffregister",
  "payrun",
  "advances",
  "leave",
  "purchaseorder",
  "supplierinvoice",
  "remittance",
  "statement",
  "ageanalysis",
  "team",
  "invoice_recurring",
  ...STRUCTURED_ONLY,
];

// Recurring invoices are the one soft restriction on Solo (the tool works, the
// recurrence toggle doesn't). Everything else is a hard lock via isLocked().
export const SOLO_RESTRICTED: Partial<Record<ToolId, { limit?: number; recurring?: boolean; message: string }>> = {
  invoice: { recurring: true, message: "Recurring invoices are a Trade feature. Upgrade to auto-invoice your monthly accounts." },
};

export const UPGRADE_DETAILS: Partial<Record<ToolId | "team" | "invoice_recurring", { title: string; desc: string; icon: string }>> = {
  team: { title: "Staff Logins", desc: "Invite your people, give each a login and control who sees what. Trade includes up to 5; Structured is unlimited.", icon: "👥" },
  staffregister: { title: "Staff & Payroll", desc: "Add employees, calculate wages and generate payslips. Included from Trade.", icon: "👤" },
  payrun: { title: "Pay Runs", desc: "Calculate PAYE, UIF and SDL, run payroll and share professional payslips. Included from Trade.", icon: "💵" },
  advances: { title: "Staff Advances", desc: "Track employee loans and repayments. Included from Trade.", icon: "💰" },
  leave: { title: "Leave Tracking", desc: "Track employee leave, linked to your pay runs. Included from Trade.", icon: "🏖️" },
  purchaseorder: { title: "Purchase Orders", desc: "Formal requests to suppliers before they deliver. Included from Trade.", icon: "🛒" },
  supplierinvoice: { title: "Supplier Invoices", desc: "Record and track invoices you receive from suppliers. Included from Trade.", icon: "📥" },
  remittance: { title: "Remittance Advice", desc: "Tell suppliers exactly which invoice you're paying. Included from Trade.", icon: "🧾" },
  statement: { title: "Customer Statements", desc: "Send customers a summary of their account. Included from Trade.", icon: "📃" },
  ageanalysis: { title: "Age Analysis", desc: "See who owes you and who you owe, aged by overdue days. Included from Trade.", icon: "⏳" },
  invoice_recurring: { title: "Recurring Invoices", desc: "Auto-create invoices every week, month, quarter or year — perfect for retainers and monthly accounts. Included from Trade.", icon: "🔁" },
  vat201: { title: "VAT201 Tracking", desc: "Track your VAT201 status and figures once you're registered for VAT. Included on Structured.", icon: "🏦" },
  emp201: { title: "EMP201 Tracking", desc: "Track your monthly EMP201 payroll-tax status — PAYE, UIF and SDL. Included on Structured.", icon: "👷" },
  provtax: { title: "Provisional Tax", desc: "Provisional tax deadlines and amounts, worked out for you. Included on Structured.", icon: "📅" },
  compliance: { title: "Compliance Dashboard", desc: "Track every SA business obligation — SARS, Labour, CIPC, POPIA — status and due dates in one place. Included on Structured.", icon: "✅" },
};

export const isLocked = (plan: Plan, toolId: ToolId | "team" | "invoice_recurring"): boolean => {
  if (plan === "structured") return false;
  if (plan === "trade") return STRUCTURED_ONLY.includes(toolId as ToolId);
  // solo: locked out of everything that needs Trade or Structured.
  return TRADE_PLUS.includes(toolId);
};

export const isRestricted = (plan: Plan, toolId: ToolId) => (plan === "solo" ? SOLO_RESTRICTED[toolId] : undefined);

// Which tier a locked feature upgrades you to: the tax/compliance suite is
// Structured; everything else that's locked is a Trade feature. "team" on Trade
// is the exception — team is unlocked there but capped at 5 logins, so hitting
// the cap points at Structured (unlimited), not back at Trade.
export const upgradeTargetPlan = (currentPlan: Plan, feature: ToolId | "team" | "invoice_recurring"): Plan => {
  if (STRUCTURED_ONLY.includes(feature as ToolId)) return "structured";
  if (feature === "team" && currentPlan === "trade") return "structured";
  return "trade";
};
