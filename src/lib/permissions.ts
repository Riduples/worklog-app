// Per-tool access control (v2 Phase 10). Ported from worklog-v65.jsx's
// "PERMISSION SYSTEM" section (ACCESS_LEVELS/TOOL_CATEGORIES/TOOL_LABELS/
// PERMISSION_PRESETS/getAccess). Owners always have full access regardless of
// their permissions row; everyone else is gated per-tool by this map.

export type AccessLevel = "off" | "view" | "edit" | "approve" | "full";

export type ToolId =
  | "income"
  | "expense"
  | "profit"
  | "bankstatement"
  | "cashup"
  | "ledger"
  | "quote"
  | "invoice"
  | "statement"
  | "purchaseorder"
  | "supplierinvoice"
  | "remittance"
  | "clients"
  | "suppliers"
  | "stock"
  | "recipe"
  | "booking"
  | "staffregister"
  | "payrun"
  | "advances"
  | "leave"
  | "timetrack"
  | "mileage"
  | "profitloss"
  | "ageanalysis"
  | "taxdashboard"
  | "compliance"
  | "vat201"
  | "emp201"
  | "provtax"
  | "tax"
  | "taxjar";

export type Permissions = Partial<Record<ToolId, AccessLevel>>;

export type PermissionedMember = {
  role: string;
  permissions: Permissions | null | undefined;
};

export const ACCESS_LEVELS: {
  id: AccessLevel;
  icon: string;
  label: string;
  desc: string;
  color: string;
  bg: string;
  border: string;
}[] = [
  { id: "off", icon: "⬜", label: "No access", desc: "Hidden — user cannot see this tool at all", color: "#94a3b8", bg: "#f8fafc", border: "#e2e8f0" },
  { id: "view", icon: "👁", label: "View", desc: "Read-only — can open and see data, cannot change anything", color: "#1e40af", bg: "#eff6ff", border: "#bfdbfe" },
  { id: "edit", icon: "✏️", label: "Edit", desc: "Can create and modify records — cannot delete", color: "#92400e", bg: "#fff7ed", border: "#fed7aa" },
  { id: "approve", icon: "✔️", label: "Approve", desc: "Can sign off and finalise records (e.g. pay runs, invoices)", color: "#0369A1", bg: "#F0F9FF", border: "#BAE6FD" },
  { id: "full", icon: "✅", label: "Full", desc: "Complete access — create, edit, approve and delete", color: "#0C4A6E", bg: "#F0F9FF", border: "#7DD3FC" },
];

export const ACCESS_LEVEL_MAP = Object.fromEntries(ACCESS_LEVELS.map((l) => [l.id, l])) as Record<
  AccessLevel,
  (typeof ACCESS_LEVELS)[number]
>;

export const TOOL_CATEGORIES: { id: string; label: string; icon: string; desc: string; tools: ToolId[] }[] = [
  { id: "stock", label: "Price List", icon: "📋", desc: "Saved items, materials & labour rates · Cost Calculator", tools: ["stock", "recipe"] },
  { id: "contacts", label: "Contacts", icon: "👥", desc: "Saved customers & suppliers for quick access", tools: ["clients", "suppliers"] },
  { id: "invoicing", label: "Sales", icon: "📤", desc: "Quotes & invoices you send to customers", tools: ["quote", "invoice", "statement"] },
  { id: "purchases", label: "Purchases", icon: "📥", desc: "Purchase orders & supplier invoices you receive", tools: ["purchaseorder", "supplierinvoice", "remittance"] },
  { id: "bookings", label: "Scheduling System", icon: "📅", desc: "Diary, appointments, time & travel — manage how you spend your day", tools: ["booking", "timetrack", "mileage"] },
  { id: "workers", label: "Payroll", icon: "💼", desc: "Employees, wages, payslips & advances", tools: ["staffregister", "payrun", "advances", "leave"] },
  // "ledger" isn't in the source prototype's categories (it dropped Ledgers
  // from the matrix) but the tool exists here, so it needs a home to be gated.
  { id: "money", label: "Money", icon: "💰", desc: "Track what comes in and goes out", tools: ["income", "expense", "bankstatement", "cashup", "ledger"] },
  { id: "taxcompliance", label: "Tax & Compliance", icon: "💡", desc: "Everything tax, SARS and compliance — your complete financial overview", tools: ["taxdashboard", "vat201", "emp201", "provtax", "taxjar", "profitloss", "profit", "ageanalysis", "compliance", "tax"] },
];

export const TOOL_LABELS: Partial<Record<ToolId, { icon: string; label: string; desc?: string }>> = {
  income: { icon: "💰", label: "Log Income", desc: "Record cash or payments you received" },
  expense: { icon: "💸", label: "Log Expense", desc: "Record money you spent on your business" },
  profit: { icon: "💵", label: "Cash Position", desc: "Actual cash in vs out — unpaid invoices and what you owe shown separately" },
  bankstatement: { icon: "🏦", label: "Import Statement", desc: "Upload your bank statement — auto-extracts every transaction" },
  cashup: { icon: "🧮", label: "Daily Cash-Up", desc: "Count your till at the end of the day and check it matches what you logged" },
  ledger: { icon: "📒", label: "Ledgers", desc: "Track who owes you and who you owe on account" },
  quote: { icon: "📋", label: "Quote", desc: "Send a price to a customer before the job" },
  invoice: { icon: "📤", label: "Invoice", desc: "Bill a customer and track payment" },
  statement: { icon: "📃", label: "Statement", desc: "A summary you can send a customer showing everything they've bought and what they still owe" },
  purchaseorder: { icon: "🛒", label: "Purchase Order", desc: "A formal request to a supplier before they deliver goods or services — most small businesses can skip this" },
  supplierinvoice: { icon: "📥", label: "Supplier Invoice", desc: "Record an invoice you received from a supplier" },
  remittance: { icon: "🧾", label: "Remittance Advice", desc: "A note telling a supplier exactly which of their invoices you're paying — mainly for businesses with supplier accounts" },
  clients: { icon: "👤", label: "Customers", desc: "People or businesses that buy from you" },
  suppliers: { icon: "🏪", label: "Suppliers", desc: "Businesses or people you buy from" },
  stock: { icon: "📋", label: "Items", desc: "Saved materials & labour rates for line items" },
  recipe: { icon: "🧮", label: "Cost Calculator", desc: "Cost any job, project or product and set a price" },
  booking: { icon: "📓", label: "Diary", desc: "Appointments with clients & suppliers" },
  staffregister: { icon: "👤", label: "Staff Register", desc: "Add & manage employees — ID, rate, schedule" },
  payrun: { icon: "💵", label: "Pay Run", desc: "Calculate wages, deductions & generate payslips" },
  advances: { icon: "💰", label: "Advances", desc: "Record employee loans & track repayments" },
  leave: { icon: "🏖️", label: "Leave", desc: "Record & track leave per employee — links to Pay Run" },
  timetrack: { icon: "⏱️", label: "Time Log", desc: "Log hours per client — links to quotes, rates & appointments" },
  mileage: { icon: "🚗", label: "Trip Log", desc: "Log business trips — SARS deduction auto-calculated" },
  profitloss: { icon: "📈", label: "Profit & Loss", desc: "The official summary of what your business earned vs spent — needed for SARS and for loan/funding applications" },
  ageanalysis: { icon: "⏳", label: "Age Analysis", desc: "See who still owes you money (and who you still owe), sorted by how overdue it is — mainly for businesses that let customers pay later" },
  taxdashboard: { icon: "💡", label: "Tax & Compliance", desc: "Your complete tax picture — SARS, compliance status and all numbers in one place" },
  compliance: { icon: "✅", label: "Compliance Dashboard", desc: "Every SA business obligation — SARS, Labour, CIPC, POPIA — due dates and status in one place" },
  vat201: { icon: "🏦", label: "VAT201", desc: "The monthly/bi-monthly SARS return for VAT-registered businesses — you only need this if you're registered for VAT" },
  emp201: { icon: "👷", label: "EMP201", desc: "The monthly SARS return for tax deducted from employee wages — only needed once you have staff on payroll" },
  provtax: { icon: "📅", label: "Provisional Tax", desc: "An estimate of the income tax you'll owe SARS, paid twice a year in advance — required if you're not a registered company on PAYE" },
  tax: { icon: "📖", label: "Rate & Tax Guide", desc: "Turnover Tax, VAT thresholds, rate calculator" },
  taxjar: { icon: "🫙", label: "Tax Jar Tracker", desc: "Running total of tax set aside from every income entry" },
};

export const DEFAULT_PERMISSIONS = (): Permissions => {
  const perms: Permissions = {};
  TOOL_CATEGORIES.forEach((cat) => cat.tools.forEach((t) => { perms[t] = "off"; }));
  return perms;
};

const LEVEL_ORDER: AccessLevel[] = ["off", "view", "edit", "approve", "full"];

export const getAccess = (member: PermissionedMember, toolId: ToolId): AccessLevel => {
  if (member.role === "owner") return "full";
  return member.permissions?.[toolId] || "off";
};
export const canSee = (member: PermissionedMember, toolId: ToolId) => getAccess(member, toolId) !== "off";
export const canView = (member: PermissionedMember, toolId: ToolId) =>
  (["view", "edit", "approve", "full"] as AccessLevel[]).includes(getAccess(member, toolId));
export const canEdit = (member: PermissionedMember, toolId: ToolId) =>
  (["edit", "approve", "full"] as AccessLevel[]).includes(getAccess(member, toolId));
export const canApprove = (member: PermissionedMember, toolId: ToolId) =>
  (["approve", "full"] as AccessLevel[]).includes(getAccess(member, toolId));
export const canDelete = (member: PermissionedMember, toolId: ToolId) => getAccess(member, toolId) === "full";

export const getCatLevel = (perms: Permissions, cat: (typeof TOOL_CATEGORIES)[number]): AccessLevel =>
  cat.tools
    .map((t) => perms[t] || "off")
    .reduce((best, l) => (LEVEL_ORDER.indexOf(l) > LEVEL_ORDER.indexOf(best) ? l : best), "off" as AccessLevel);

export const PERMISSION_PRESETS: { id: string; icon: string; label: string; desc: string; build: () => Permissions }[] = [
  {
    id: "logger",
    icon: "✍️",
    label: "Can log only",
    desc: "Can add income, expenses, quotes & bookings day-to-day. Can't see reports, delete anything, or run payroll.",
    build: () => {
      const p = DEFAULT_PERMISSIONS();
      (["income", "expense", "cashup", "quote", "invoice", "booking", "timetrack", "mileage", "stock", "recipe", "clients"] as ToolId[]).forEach(
        (t) => { p[t] = "edit"; }
      );
      return p;
    },
  },
  {
    id: "viewer",
    icon: "👁",
    label: "Can see everything",
    desc: "Can open and check any tool or report. Can't add, edit, delete or approve anything.",
    build: () => {
      const p: Permissions = {};
      TOOL_CATEGORIES.forEach((c) => c.tools.forEach((t) => { p[t] = "view"; }));
      return p;
    },
  },
  {
    id: "manager",
    icon: "✅",
    label: "Full control (manager)",
    desc: "Complete access — same as the owner. Only give this to someone you fully trust.",
    build: () => {
      const p: Permissions = {};
      TOOL_CATEGORIES.forEach((c) => c.tools.forEach((t) => { p[t] = "full"; }));
      return p;
    },
  },
];

export const matchesPreset = (localPerms: Permissions, presetPerms: Permissions): boolean => {
  const allTools = new Set([...Object.keys(presetPerms), ...Object.keys(localPerms)]) as Set<ToolId>;
  for (const t of allTools) {
    if ((localPerms[t] || "off") !== (presetPerms[t] || "off")) return false;
  }
  return true;
};
