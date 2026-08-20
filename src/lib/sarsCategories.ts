export type SarsCategory = { label: string; sars: string; group: string };

const SARS_INCOME_CATEGORIES: SarsCategory[] = [
  { label: "Job payment / service rendered", sars: "Trading income — Services rendered", group: "Trading Income" },
  { label: "Product sale", sars: "Trading income — Sale of goods", group: "Trading Income" },
  { label: "Stock sale", sars: "Trading income — Sale of trading stock", group: "Trading Income" },
  { label: "Contract / project payment", sars: "Trading income — Contract income", group: "Trading Income" },
  { label: "Subcontract work done", sars: "Trading income — Subcontracted services", group: "Trading Income" },
  { label: "Consulting fee", sars: "Trading income — Professional/consulting fees", group: "Trading Income" },
  { label: "Commission earned", sars: "Trading income — Commission income", group: "Trading Income" },
  { label: "Deposit received", sars: "Trading income — Deposit (advance payment)", group: "Deposits & Payments" },
  { label: "Balance / final payment", sars: "Trading income — Balance of contract price", group: "Deposits & Payments" },
  { label: "Progress payment", sars: "Trading income — Progress claim", group: "Deposits & Payments" },
  { label: "Retainer payment", sars: "Trading income — Recurring retainer fee", group: "Deposits & Payments" },
  { label: "Platform payout (Uber/Bolt/delivery)", sars: "Trading income — Platform/gig earnings", group: "Platform Income" },
  { label: "Tip received", sars: "Trading income — Gratuity/tip income", group: "Platform Income" },
  { label: "Rental income", sars: "Other income — Rental income", group: "Other Income" },
  { label: "Interest received", sars: "Other income — Interest received", group: "Other Income" },
  { label: "Chair rental / space rental income", sars: "Trading income — Rental of business space", group: "Other Income" },
  { label: "Refund received", sars: "Other income — Refund / reimbursement", group: "Refunds" },
  { label: "Insurance payout", sars: "Other income — Insurance claim proceeds", group: "Refunds" },
  { label: "Bad debt recovered", sars: "Other income — Recovery of bad debt", group: "Refunds" },
  { label: "Loan received", sars: "Non-trading — Loan capital received", group: "Loans & Capital" },
  { label: "Owner's capital contribution", sars: "Non-trading — Capital introduced by owner", group: "Loans & Capital" },
  { label: "Grant / funding received", sars: "Non-trading — Grant income (check taxability)", group: "Loans & Capital" },
  { label: "Other income", sars: "Other income — Sundry income", group: "Other Income" },
];

const SARS_CATEGORIES: SarsCategory[] = [
  { label: "Materials & supplies", sars: "Cost of sales — Materials", group: "Cost of Sales" },
  { label: "Stock / trading stock", sars: "Cost of sales — Trading stock", group: "Cost of Sales" },
  { label: "Packaging", sars: "Cost of sales — Packaging", group: "Cost of Sales" },
  { label: "Subcontractor payments", sars: "Cost of sales — Subcontract labour", group: "Cost of Sales" },
  { label: "Direct labour cost", sars: "Cost of sales — Direct wages", group: "Cost of Sales" },
  { label: "Wages & salaries paid", sars: "Employee costs — Salaries & wages", group: "Employee Costs" },
  { label: "UIF contributions", sars: "Employee costs — UIF employer contribution", group: "Employee Costs" },
  { label: "SDL (skills levy)", sars: "Employee costs — Skills development levy", group: "Employee Costs" },
  { label: "COIDA / workman's comp", sars: "Employee costs — COIDA contributions", group: "Employee Costs" },
  { label: "Staff meals & refreshments", sars: "Employee costs — Staff welfare", group: "Employee Costs" },
  { label: "Fuel & oil", sars: "Motor vehicle — Fuel & oil", group: "Motor Vehicle" },
  { label: "Vehicle repairs & maintenance", sars: "Motor vehicle — Repairs & maintenance", group: "Motor Vehicle" },
  { label: "Vehicle insurance", sars: "Motor vehicle — Insurance", group: "Motor Vehicle" },
  { label: "Tyres", sars: "Motor vehicle — Tyres", group: "Motor Vehicle" },
  { label: "Licence & registration", sars: "Motor vehicle — Licence fees", group: "Motor Vehicle" },
  { label: "Toll fees", sars: "Motor vehicle — Tolls", group: "Motor Vehicle" },
  { label: "Parking", sars: "Motor vehicle — Parking fees", group: "Motor Vehicle" },
  { label: "Flights & accommodation", sars: "Travel — Flights & accommodation", group: "Travel" },
  { label: "Public transport", sars: "Travel — Public transport", group: "Travel" },
  { label: "Rent / premises", sars: "Premises — Rent paid", group: "Premises & Utilities" },
  { label: "Home office (proportional)", sars: "Premises — Home office expenses", group: "Premises & Utilities" },
  { label: "Electricity", sars: "Premises — Electricity", group: "Premises & Utilities" },
  { label: "Water & rates", sars: "Premises — Water & municipal rates", group: "Premises & Utilities" },
  { label: "Repairs to premises", sars: "Premises — Repairs & maintenance", group: "Premises & Utilities" },
  { label: "Cleaning of premises", sars: "Premises — Cleaning costs", group: "Premises & Utilities" },
  { label: "Security", sars: "Premises — Security costs", group: "Premises & Utilities" },
  { label: "Tools & equipment", sars: "Assets — Tools & small equipment", group: "Equipment & Assets" },
  { label: "Equipment repairs", sars: "Assets — Repairs & maintenance", group: "Equipment & Assets" },
  { label: "Computer & software", sars: "Assets — Computer equipment & software", group: "Equipment & Assets" },
  { label: "Mobile phone (business portion)", sars: "Assets — Mobile phone", group: "Equipment & Assets" },
  { label: "Data & airtime", sars: "Communication — Data & airtime", group: "Communication" },
  { label: "Internet", sars: "Communication — Internet costs", group: "Communication" },
  { label: "Telephone / landline", sars: "Communication — Telephone", group: "Communication" },
  { label: "Bank charges", sars: "Finance — Bank charges & fees", group: "Finance" },
  { label: "Interest paid on loan", sars: "Finance — Interest expense", group: "Finance" },
  { label: "Platform fees (Uber/Bolt etc)", sars: "Finance — Commission & agency fees", group: "Finance" },
  { label: "Credit card fees", sars: "Finance — Bank charges & fees", group: "Finance" },
  { label: "Cash deposit fees", sars: "Finance — Bank charges & fees", group: "Finance" },
  { label: "Business insurance", sars: "Insurance — Business insurance premiums", group: "Insurance" },
  { label: "Public liability insurance", sars: "Insurance — Public liability premiums", group: "Insurance" },
  { label: "Life / disability insurance (business)", sars: "Insurance — Life & disability premiums", group: "Insurance" },
  { label: "Advertising & marketing", sars: "Marketing — Advertising costs", group: "Marketing" },
  { label: "Social media promotion", sars: "Marketing — Advertising costs", group: "Marketing" },
  { label: "Printing & flyers", sars: "Marketing — Printing & stationery", group: "Marketing" },
  { label: "Client gifts & entertainment", sars: "Marketing — Entertainment (limited deductibility)", group: "Marketing" },
  { label: "Stationery & office supplies", sars: "Admin — Stationery & printing", group: "Admin" },
  { label: "Accounting & bookkeeping fees", sars: "Admin — Professional fees", group: "Admin" },
  { label: "Legal fees", sars: "Admin — Legal fees", group: "Admin" },
  { label: "Courier & postage", sars: "Admin — Postage & courier", group: "Admin" },
  { label: "Subscriptions (business)", sars: "Admin — Subscriptions", group: "Admin" },
  { label: "Protective clothing", sars: "Protective clothing — Deductible in full", group: "Protective Clothing" },
  { label: "Uniforms", sars: "Protective clothing — Deductible in full", group: "Protective Clothing" },
  { label: "Safety equipment", sars: "Protective clothing — Safety gear", group: "Protective Clothing" },
  { label: "Training & courses", sars: "Training — Staff & owner training", group: "Training" },
  { label: "Books & reference material", sars: "Training — Educational material", group: "Training" },
  { label: "VAT paid over to SARS", sars: "Tax — VAT payable", group: "Tax & Compliance" },
  { label: "PAYE paid over to SARS", sars: "Tax — PAYE payable", group: "Tax & Compliance" },
  { label: "Income tax paid to SARS", sars: "Tax — Income tax payable", group: "Tax & Compliance" },
  { label: "Provisional tax paid to SARS", sars: "Tax — Provisional tax payable", group: "Tax & Compliance" },
  { label: "Tax practitioner fee", sars: "Tax — Professional fees", group: "Tax & Compliance" },
  { label: "Bad debt written off", sars: "Other — Bad debts (section 11(a))", group: "Other" },
  { label: "Donations (approved PBO)", sars: "Other — Donations (section 18A)", group: "Other" },
  { label: "Other business expense", sars: "Other — Sundry expenses", group: "Other" },
];

// What the tax jar provisions for: income tax, and the provisional payments
// that settle it. VAT and PAYE are deliberately excluded -- VAT is collected on
// a customer's behalf and PAYE is employees' tax, so neither is settled out of
// an income tax provision. Matched exactly on the stored `sars` value, not by
// searching for "SARS" in free text, which would sweep both of those in.
const INCOME_TAX_PAYMENT_CATEGORIES: string[] = [
  "Tax — Income tax payable",
  "Tax — Provisional tax payable",
];

export const isIncomeTaxPayment = (sarsCategory: string | null | undefined): boolean =>
  !!sarsCategory && INCOME_TAX_PAYMENT_CATEGORIES.includes(sarsCategory);

// Payment methods split by direction: how money is *received* is not how it is
// *paid*. A trades business rarely collects by debit order but pays plenty of
// things that way; and when receiving a card payment the debit-vs-credit split
// is the customer's card, not yours, so it collapses to one "Card".
export const INCOME_PAYMENT_METHODS = [
  "Cash",
  "EFT / Bank transfer",
  "Card",
  // Money can arrive by debit order too — a subscription or a retainer the
  // business collects off its customer, not only one it pays out.
  "Debit order",
  "Voucher / Gift card",
  "Other",
];

export const EXPENSE_PAYMENT_METHODS = [
  "Cash",
  "EFT / Bank transfer",
  // One Card chip, not two. Debit or credit is a property of the account the
  // card belongs to — which the entry already carries — so asking again at the
  // till only invites a wrong answer on a card people do not think of either way.
  "Card",
  "Debit order",
  "Voucher / Gift card",
  "Other",
];

// Retired chips. Nobody can pick these any more, but rows captured before the
// two card chips became one still hold them, and the AI ingest routes have to
// keep validating what is already in the table.
const LEGACY_PAYMENT_METHODS = ["Card (debit)", "Card (credit)"];

// The union of both directions, deduped and order-preserving. The AI ingest
// routes (quick-log, parse-statement) classify income AND expenses in one enum,
// and any historical method string must still validate, so they use this.
export const ALL_PAYMENT_METHODS = [
  ...INCOME_PAYMENT_METHODS,
  ...EXPENSE_PAYMENT_METHODS.filter((m) => !INCOME_PAYMENT_METHODS.includes(m)),
  ...LEGACY_PAYMENT_METHODS,
];

// Once an entry is tagged to a specific account, the methods narrow to what that
// account can physically do (its "bank setup"): a cash box can't do an EFT, a
// credit-card account can't pay cash. We FILTER the direction list (INCOME/
// EXPENSE) rather than replace it, so the income-vs-expense split is preserved
// and only the labels that don't fit the account drop out. "Other" is always
// kept as an escape hatch, and so is a voucher — a gift card is its own tender
// and comes out of no account at all, so no account can rule it out.
// An untagged or unknown account narrows nothing.
// account_type values come from AccountsView: bank | savings | credit | cash | other.
const ACCOUNT_ALLOWED_METHODS: Record<string, readonly string[]> = {
  cash: ["Cash", "Voucher / Gift card"],
  credit: ["Card (debit)", "Card (credit)", "Card", "Debit order"],
  savings: ["EFT / Bank transfer", "Debit order", "Cash"],
  bank: ["EFT / Bank transfer", "Card (debit)", "Card (credit)", "Card", "Debit order", "Cash"],
};

export function narrowMethodsForAccount(
  methods: readonly string[],
  accountType: string | null | undefined
): string[] {
  const allowed = accountType ? ACCOUNT_ALLOWED_METHODS[accountType] : undefined;
  if (!allowed) return [...methods];
  return methods.filter((m) => m === "Other" || m === "Voucher / Gift card" || allowed.includes(m));
}

function getSarsMatchFromList(list: SarsCategory[], text: string) {
  if (!text || text.length < 2) return [];
  const lower = text.toLowerCase();
  return list
    .filter(
      (c) =>
        c.label.toLowerCase().includes(lower) ||
        c.sars.toLowerCase().includes(lower) ||
        c.group.toLowerCase().includes(lower)
    )
    .slice(0, 6);
}

export function getSarsMatch(text: string) {
  return getSarsMatchFromList(SARS_CATEGORIES, text);
}

export function getSarsIncomeMatch(text: string) {
  return getSarsMatchFromList(SARS_INCOME_CATEGORIES, text);
}

/**
 * The category a stored `sars` string belongs to, or null if it matches nothing.
 *
 * Rows store the `sars` account name ("Premises — Electricity"), which is what
 * SARS wants to see, while every screen shows the plain-English `label` ("Water
 * & rates"). A form editing a saved category therefore has to look the row's
 * value back up to display it — and to keep displaying the friendly half rather
 * than the accounting one.
 *
 * Searches both lists because a caller holding only a stored string doesn't
 * necessarily know which side it came from; the two lists share no `sars` values.
 */
export function findSarsCategory(sars: string | null | undefined): SarsCategory | null {
  if (!sars) return null;
  return (
    SARS_INCOME_CATEGORIES.find((c) => c.sars === sars) ??
    SARS_CATEGORIES.find((c) => c.sars === sars) ??
    null
  );
}
