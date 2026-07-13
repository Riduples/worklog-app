export type CsvImportType = "stock" | "client" | "supplier";

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

export const CSV_TEMPLATES: Record<CsvImportType, CsvTemplate> = {
  stock: {
    label: "Stock items",
    filename: "worklog-stock-template.csv",
    columns: [
      { csvHeader: "name", required: true },
      { csvHeader: "qty" },
      { csvHeader: "cost_price" },
      { csvHeader: "sell_price" },
      { csvHeader: "reorder_level" },
    ],
    sampleRow: { name: "Cement 50kg", qty: "20", cost_price: "85", sell_price: "120", reorder_level: "5" },
  },
  client: {
    label: "Clients",
    filename: "worklog-clients-template.csv",
    columns: [
      { csvHeader: "name", required: true },
      { csvHeader: "phone" },
      { csvHeader: "email" },
      { csvHeader: "payment_behaviour" },
      { csvHeader: "notes" },
    ],
    sampleRow: {
      name: "Thabo Nkosi",
      phone: "0821234567",
      email: "thabo@example.com",
      payment_behaviour: "Good payer",
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
      { csvHeader: "payment_terms" },
      { csvHeader: "notes" },
    ],
    sampleRow: {
      name: "John's Hardware",
      phone: "0119876543",
      email: "sales@johns.co.za",
      payment_terms: "30 days",
      notes: "Building materials",
    },
  },
};

export function buildTemplateCsv(type: CsvImportType): string {
  const t = CSV_TEMPLATES[type];
  const headers = t.columns.map((c) => c.csvHeader);
  const sample = headers.map((h) => t.sampleRow[h] ?? "");
  return `${headers.join(",")}\n${sample.join(",")}`;
}
