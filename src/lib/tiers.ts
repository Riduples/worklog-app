// Subscription tiers (v2 Phase 10). Ported from worklog-v65.jsx's TIERS/
// SOLO_LOCKED/SHOEBOX_LOCKED/SOLO_RESTRICTED/UPGRADE_DETAILS. No billing
// integration — "plan" is a manual flag on business_profiles per the product
// decision to defer real payment-processor wiring.

import type { ToolId } from "@/lib/permissions";

export type Plan = "shoebox" | "solo" | "business";

export const TIERS: Record<Plan, { label: string; price: string; color: string; bg: string; border: string }> = {
  shoebox: { label: "Shoebox", price: "R50/mo", color: "#334155", bg: "#f8fafc", border: "#e2e8f0" },
  solo: { label: "Solo", price: "R99/mo", color: "#0C4A6E", bg: "#F0F9FF", border: "#7DD3FC" },
  business: { label: "Business", price: "R199/mo", color: "#1e40af", bg: "#eff6ff", border: "#bfdbfe" },
};

// Tools locked on Solo — show lock icon + upgrade prompt.
export const SOLO_LOCKED: ToolId[] = ["emp201"];

// Shoebox (free-ish tier) is deliberately just "the digital version of a
// shoebox of receipts" — Money + basic Sales + Diary. Everything else nudges
// an upgrade once the business is ready for it.
export const SHOEBOX_LOCKED: (ToolId | "team")[] = [
  "staffregister", "payrun", "advances", "leave", "emp201", "vat201", "provtax",
  "compliance", "ageanalysis", "purchaseorder", "supplierinvoice", "remittance", "statement",
];

// Tools with restrictions on Solo (work, but with limits).
export const SOLO_RESTRICTED: Partial<Record<ToolId, { limit?: number; recurring?: boolean; message: string }>> = {
  staffregister: { limit: 2, message: "Solo includes up to 2 employees. Upgrade to Business for unlimited staff." },
  // Solo genuinely calculates PAYE, UIF and SDL — withholding statutory
  // deductions to drive an upsell would hand Solo users a non-compliant
  // payroll. The real Business-only extras are payslip sharing and EMP201.
  payrun: { message: "Solo calculates PAYE, UIF and SDL in full. Upgrade to Business to share payslips and generate the EMP201 return." },
  invoice: { recurring: true, message: "Recurring invoices are a Business feature. Upgrade to auto-invoice your monthly accounts." },
};

// Multi-user is locked on Solo and Shoebox — Business plan only.
export const SOLO_NO_TEAM = true;

export const UPGRADE_DETAILS: Partial<Record<ToolId | "team" | "invoice_recurring", { title: string; desc: string; icon: string }>> = {
  emp201: { title: "EMP201 Payroll Return", desc: "Generate your monthly SARS EMP201 return with PAYE, UIF and SDL per employee.", icon: "👷" },
  team: { title: "Multi-user & Roles", desc: "Invite your team, assign roles and control who sees what — ideal for growing businesses.", icon: "👥" },
  staffregister: { title: "Staff & Payroll", desc: "Add employees, calculate wages and generate payslips. Free on Solo for up to 2 employees.", icon: "👤" },
  payrun: { title: "Full Payroll Features", desc: "Share professional payslips with your staff, generate the monthly EMP201 return, and run payroll for unlimited employees.", icon: "💵" },
  advances: { title: "Staff Advances", desc: "Track employee loans and repayments once you're paying staff.", icon: "💰" },
  leave: { title: "Leave Tracking", desc: "Track employee leave once you're paying staff.", icon: "🏖️" },
  vat201: { title: "VAT201 Returns", desc: "Generate your SARS VAT return once you're registered for VAT.", icon: "🏦" },
  provtax: { title: "Provisional Tax", desc: "IRP6 estimator for provisional tax — useful once your income is more established.", icon: "📅" },
  compliance: { title: "Compliance Dashboard", desc: "Track every SA business obligation — SARS, Labour, CIPC, POPIA — in one place.", icon: "✅" },
  ageanalysis: { title: "Age Analysis", desc: "See who owes you and who you owe, aged by overdue days — useful once you let customers pay on account.", icon: "⏳" },
  purchaseorder: { title: "Purchase Orders", desc: "Formal requests to suppliers — useful once you're running supplier accounts.", icon: "🛒" },
  supplierinvoice: { title: "Supplier Invoices", desc: "Track invoices from suppliers once you're running accounts with them.", icon: "📥" },
  remittance: { title: "Remittance Advice", desc: "Tell suppliers exactly which invoice you're paying.", icon: "🧾" },
  statement: { title: "Customer Statements", desc: "Send customers a summary of their account once you let them pay on account.", icon: "📃" },
  invoice_recurring: { title: "Recurring Invoices", desc: "Auto-create invoices every week, month, quarter or year. Perfect for retainers, security contracts, cleaning accounts and IT support agreements.", icon: "🔁" },
};

export const isLocked = (plan: Plan, toolId: ToolId | "team"): boolean =>
  (plan === "solo" && SOLO_LOCKED.includes(toolId as ToolId)) ||
  (plan === "shoebox" && SHOEBOX_LOCKED.includes(toolId)) ||
  (toolId === "team" && plan !== "business" && SOLO_NO_TEAM);

export const isRestricted = (plan: Plan, toolId: ToolId) => (plan === "solo" ? SOLO_RESTRICTED[toolId] : undefined);

export const upgradeTargetPlan = (currentPlan: Plan, feature: ToolId | "team"): Plan => {
  const businessOnly = feature === "team" || SOLO_LOCKED.includes(feature as ToolId);
  return currentPlan === "shoebox" && !businessOnly ? "solo" : "business";
};
