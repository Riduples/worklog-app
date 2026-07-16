import type { ToolId } from "@/lib/permissions";

// Progressive disclosure. Ported from worklog-v65.jsx:792-812.
//
// The point is reducing overwhelm, not access control: a salon owner opening
// WORKLOG for the first time should see a till and a diary, not Purchase Orders
// and Age Analysis. Nothing here is ever locked — "Show every tool" in Business
// Details restores the full set, and permissions/tiers do the actual gating.

export type BusinessType = "salon" | "retail" | "food" | "trade" | "cleaning" | "freelance" | "other";

export const BUSINESS_TYPES: { id: BusinessType; label: string }[] = [
  { id: "salon", label: "Salon / Beauty / Barber" },
  { id: "retail", label: "Spaza / Retail shop" },
  { id: "food", label: "Takeaway / Café" },
  { id: "trade", label: "Plumber / Electrician / Contractor" },
  { id: "cleaning", label: "Cleaning / Gardening" },
  { id: "freelance", label: "Freelancer / Solo service" },
  { id: "other", label: "Other" },
];

// Ported verbatim from the prototype, which the handoff calls "the source of
// truth for behaviour". Two deliberate edits:
//
//  - "taxdashboard" is dropped: it named the /tax hub, which "tax" already
//    gates here, so it was a second id for one screen (see permissions.ts).
//  - "other" maps to null = no filtering, same as show_all_tools.
//
// Note this genuinely hides Purchase Orders, Supplier Invoices, Remittance,
// Cash Flow, Ledgers and the Compliance Dashboard from EVERY type by default —
// including trade, despite the build doc's example claiming a contractor sees
// POs. The prototype disagrees with the doc; the prototype wins.
export const BUSINESS_TYPE_CORE_TOOLS: Record<BusinessType, ToolId[] | null> = {
  salon: ["income", "expense", "bankstatement", "quote", "invoice", "clients", "stock", "recipe", "booking", "cashup", "staffregister", "payrun", "advances", "leave", "vat201", "emp201", "taxjar", "tax"],
  retail: ["income", "expense", "bankstatement", "clients", "suppliers", "stock", "cashup", "staffregister", "payrun", "advances", "leave", "vat201", "emp201", "taxjar", "tax"],
  food: ["income", "expense", "bankstatement", "clients", "suppliers", "stock", "recipe", "cashup", "staffregister", "payrun", "advances", "leave", "vat201", "emp201", "taxjar", "tax"],
  trade: ["income", "expense", "bankstatement", "quote", "invoice", "statement", "clients", "suppliers", "stock", "recipe", "booking", "timetrack", "mileage", "staffregister", "payrun", "advances", "leave", "vat201", "emp201", "provtax", "ageanalysis", "profitloss", "taxjar", "tax"],
  cleaning: ["income", "expense", "bankstatement", "quote", "invoice", "clients", "booking", "timetrack", "mileage", "staffregister", "payrun", "advances", "leave", "vat201", "taxjar", "tax"],
  freelance: ["income", "expense", "bankstatement", "quote", "invoice", "clients", "timetrack", "provtax", "profitloss", "taxjar", "tax"],
  other: null,
};

/**
 * The tools to show on the home screen, or null for "show everything".
 *
 * Returns null — i.e. no filtering — whenever the business has no type yet, has
 * an unrecognised one, or has asked to see everything. That default matters:
 * every business that existed before this shipped keeps seeing exactly what it
 * saw, and a bad value can never hide a tool someone relies on.
 */
export function coreToolsFor(
  business: { business_type?: string | null; show_all_tools?: boolean | null } | null | undefined
): ToolId[] | null {
  if (!business || business.show_all_tools) return null;
  const type = business.business_type as BusinessType | null | undefined;
  if (!type) return null;
  return BUSINESS_TYPE_CORE_TOOLS[type] ?? null;
}

/** True when `toolId` should appear on the home screen for this business. */
export function isCoreTool(coreTools: ToolId[] | null, toolId: ToolId): boolean {
  return coreTools === null || coreTools.includes(toolId);
}
