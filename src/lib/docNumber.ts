import type { SupabaseClient } from "@supabase/supabase-js";

// Each numbered series lives in a table + column. Most use a shared "doc_number"
// column; employee numbers (EMP-YYYY-NNNN) live in staff_register.employee_number.
// (Payslip numbers PS-YYYY-NNNN are assigned server-side inside create_pay_run so
// they stay atomic/race-safe, so there is no client series for them.)
const SERIES = {
  QTE: { table: "quotes", column: "doc_number" },
  INV: { table: "invoices", column: "doc_number" },
  PO: { table: "purchase_orders", column: "doc_number" },
  CN: { table: "credit_notes", column: "doc_number" },
  // Our own internal bill number for a supplier invoice, kept separate from the
  // supplier's own supplier_ref_number (each supplier numbers differently, so
  // that ref isn't a sortable sequence — this one is).
  SI: { table: "supplier_invoices", column: "doc_number" },
  EMP: { table: "staff_register", column: "employee_number" },
} as const;

export async function getNextDocNumber(
  supabase: SupabaseClient,
  businessId: string,
  prefix: keyof typeof SERIES
): Promise<string> {
  return (await getNextDocNumbers(supabase, businessId, prefix, 1))[0];
}

/**
 * The next `count` numbers in a series, in order.
 *
 * A CSV import inserts everyone in one statement, so it can't call the
 * single-number version per row — each call would read the same maximum back and
 * hand out the same number to all of them. Reading the maximum once and counting
 * up from it keeps the batch sequential.
 */
export async function getNextDocNumbers(
  supabase: SupabaseClient,
  businessId: string,
  prefix: keyof typeof SERIES,
  count: number
): Promise<string[]> {
  const year = new Date().getFullYear();
  const { table, column } = SERIES[prefix];
  const yearPrefix = `${prefix}-${year}-`;

  // Scoped by business (not the individual user) so every team member shares one
  // sequence — two members generating a number concurrently should never collide
  // within the same business.
  const { data, error } = await supabase
    .from(table)
    .select(column)
    .eq("business_id", businessId)
    .like(column, `${yearPrefix}%`);
  if (error) throw error;

  const maxNum = ((data ?? []) as Array<Record<string, unknown>>).reduce((max, row) => {
    const value = row[column];
    const match = typeof value === "string" ? /(\d{4})$/.exec(value) : null;
    const n = match ? parseInt(match[1], 10) : 0;
    return n > max ? n : max;
  }, 0);

  return Array.from({ length: count }, (_, i) => `${yearPrefix}${String(maxNum + 1 + i).padStart(4, "0")}`);
}
