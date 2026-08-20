export type CsvImportType = "stock" | "client" | "supplier" | "staff" | "account" | "banking";

type ColumnSpec = {
  csvHeader: string;
  required?: boolean;
};

export type CsvTemplate = {
  label: string;
  filename: string;
  columns: ColumnSpec[];
  sampleRow: Record<string, string>;
};

export const PAYMENT_BEHAVIOURS = ["Good payer", "Slow payer", "Problem payer"];
export const PAYMENT_TERMS = ["On delivery", "7 days", "30 days", "60 days", "Cash only", "Pre-payment"];

// Parse a numeric cell from an imported spreadsheet, tolerant of how South
// African (and continental) money is written: a currency mark, thousands
// separators (spaces, or whichever of . / , isn't the decimal), and a comma OR a
// dot decimal — "R 8 500,00", "8,500.00", "8.500,00", "1 200,50", "R120" all read
// right. The rightmost of , or . is taken as the decimal. Returns 0 for anything
// unparseable, so an import never silently divides a wage by ~1000.
export function parseCsvNumber(v: unknown): number {
  let s = String(v ?? "").trim().replace(/[Rr\s ]/g, "");
  if (!s) return 0;
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (hasComma) {
    s = /,\d{1,2}$/.test(s) ? s.replace(",", ".") : s.replace(/,/g, "");
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

export const CSV_TEMPLATES: Record<CsvImportType, CsvTemplate> = {
  stock: {
    label: "Items",
    filename: "worklog-stock-template.csv",
    columns: [
      { csvHeader: "description", required: true },
      { csvHeader: "item_type" },
      { csvHeader: "qty" },
      { csvHeader: "cost_price" },
      { csvHeader: "sell_price" },
      { csvHeader: "reorder_level" },
    ],
    sampleRow: { description: "Cement 50kg", item_type: "material", qty: "20", cost_price: "85", sell_price: "120", reorder_level: "5" },
  },
  // The columns are the Add account form, field for field and in its order, so a
  // filled-in template and a typed-in account land identically. type accepts the
  // words on the pills (bank, savings, card, cash, other) and the obvious
  // synonyms — see normaliseAccountType.
  account: {
    label: "Bank accounts",
    filename: "worklog-accounts-template.csv",
    columns: [
      { csvHeader: "name", required: true },
      { csvHeader: "type" },
      { csvHeader: "bank_name" },
      { csvHeader: "account_number" },
      { csvHeader: "opening_balance" },
      { csvHeader: "opening_balance_date" },
    ],
    sampleRow: {
      name: "FNB Cheque",
      type: "bank",
      bank_name: "FNB",
      account_number: "1234",
      opening_balance: "2500",
      opening_balance_date: "2026-01-01",
    },
  },
  // A bank statement, or anything shaped like one. Deliberately forgiving: date
  // and amount are the only columns a statement always has, and everything else
  // is an allocation the owner can make afterwards from the Needs a home filter.
  // A negative amount means money out, so an exported statement imports as-is.
  banking: {
    label: "Transactions",
    filename: "worklog-transactions-template.csv",
    columns: [
      { csvHeader: "date", required: true },
      { csvHeader: "amount" },
      { csvHeader: "type" },
      { csvHeader: "description" },
      { csvHeader: "party" },
      { csvHeader: "category" },
      { csvHeader: "reference" },
    ],
    sampleRow: {
      date: "2026-08-20",
      amount: "-650.00",
      type: "out",
      description: "Fuel at Engen Woodmead",
      party: "Engen",
      category: "Motor vehicle — Fuel & oil",
      reference: "CARD 4821",
    },
  },
  client: {
    label: "Clients",
    filename: "worklog-clients-template.csv",
    columns: [
      { csvHeader: "name", required: true },
      { csvHeader: "phone" },
      { csvHeader: "email" },
      { csvHeader: "address" },
      { csvHeader: "payment_behaviour" },
      { csvHeader: "custom_label" },
      { csvHeader: "custom_value" },
      { csvHeader: "notes" },
    ],
    sampleRow: {
      name: "Thabo Nkosi",
      phone: "0821234567",
      email: "thabo@example.com",
      address: "12 Main St, Johannesburg",
      payment_behaviour: "Good payer",
      custom_label: "Vehicle",
      custom_value: "Corsa bakkie",
      notes: "Regular customer",
    },
  },
  supplier: {
    label: "Suppliers",
    filename: "worklog-suppliers-template.csv",
    columns: [
      { csvHeader: "name", required: true },
      { csvHeader: "phone" },
      { csvHeader: "email" },
      { csvHeader: "address" },
      { csvHeader: "payment_terms" },
      { csvHeader: "bank_name" },
      { csvHeader: "account_number" },
      { csvHeader: "notes" },
    ],
    sampleRow: {
      name: "John's Hardware",
      phone: "0119876543",
      email: "sales@johns.co.za",
      address: "Cnr Eloff & Commissioner, JHB",
      payment_terms: "30 days",
      bank_name: "FNB",
      account_number: "62012345678",
      notes: "Building materials",
    },
  },
  // The columns are the Add Staff form, field for field and in its order, so a
  // filled-in template and a typed-in person land in the register identically.
  // "rate" is the one place they differ: the form shows a single rate box whose
  // label follows the pay type, and the register keeps three columns behind it.
  staff: {
    label: "Staff",
    filename: "worklog-staff-template.csv",
    columns: [
      { csvHeader: "first_name", required: true },
      { csvHeader: "last_name" },
      { csvHeader: "employment_type" },
      { csvHeader: "start_date" },
      { csvHeader: "contract_end_date" },
      { csvHeader: "pay_type" },
      { csvHeader: "rate" },
      { csvHeader: "days_per_week" },
      { csvHeader: "hours_per_day" },
      { csvHeader: "recurring_allowance" },
      { csvHeader: "recurring_allowance_desc" },
      { csvHeader: "id_number" },
      { csvHeader: "tax_number" },
      { csvHeader: "contact_number" },
      { csvHeader: "address" },
      { csvHeader: "bank_name" },
      { csvHeader: "bank_account" },
      { csvHeader: "trading_name" },
    ],
    sampleRow: {
      first_name: "Sipho",
      last_name: "Dlamini",
      employment_type: "permanent",
      start_date: "2026-01-15",
      contract_end_date: "",
      pay_type: "Monthly",
      rate: "8500",
      days_per_week: "5",
      hours_per_day: "8",
      recurring_allowance: "500",
      recurring_allowance_desc: "Travel",
      id_number: "9001015009087",
      tax_number: "1234567890",
      contact_number: "0821234567",
      address: "12 Main St, Johannesburg",
      bank_name: "FNB",
      bank_account: "62012345678",
      trading_name: "",
    },
  },
};

// Spelled out on the import screen so the file can be filled in without guessing
// what the app will accept. Both are forgiving on import (see staffCsv.ts).
export const CSV_EMPLOYMENT_TYPE_HINT = "permanent, fixed_term, casual or contractor";
export const CSV_PAY_TYPE_HINT = "Daily, Hourly or Monthly";

// A value containing a comma, a quote or a newline has to be quoted, or the
// template we hand out is itself broken CSV: the sample address "12 Main St,
// Johannesburg" split into two fields and shifted every column after it, so
// downloading the template, filling it in and uploading it imported nonsense.
function csvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function buildTemplateCsv(type: CsvImportType): string {
  const t = CSV_TEMPLATES[type];
  const headers = t.columns.map((c) => c.csvHeader);
  const sample = headers.map((h) => csvCell(t.sampleRow[h] ?? ""));
  return `${headers.join(",")}\n${sample.join(",")}`;
}
