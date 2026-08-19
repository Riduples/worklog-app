import type { SupabaseClient } from "@supabase/supabase-js";

// Each numbered series has a prefix. The numbers themselves come from the
// doc_sequences counter (migration 0120), not from reading the documents back —
// see the note on getNextDocNumbers below for why that distinction matters.
//
// (Payslip numbers PS-YYYY-NNNN are assigned inside create_pay_run and have no
// client series here.)
// Kept in step with the prefix whitelist inside reserve_doc_numbers — the
// function rejects anything else, so an addition here needs one there too.
export type DocSeries = "QTE" | "INV" | "PO" | "CN" | "SI" | "EMP";

export async function getNextDocNumber(
  supabase: SupabaseClient,
  businessId: string,
  prefix: DocSeries
): Promise<string> {
  return (await getNextDocNumbers(supabase, businessId, prefix, 1))[0];
}

/**
 * The next `count` numbers in a series, in order.
 *
 * Reserved through the reserve_doc_numbers function, which increments a counter
 * row in one INSERT ... ON CONFLICT DO UPDATE ... RETURNING statement. That
 * matters: this used to SELECT the highest number already issued and add one,
 * which is a read followed by a write with a gap in between. Two team members
 * creating an invoice in the same moment read the same maximum and were handed
 * the same number — and nothing rejected the second one, because doc_number
 * carries no unique index. A single statement takes a row lock instead, so the
 * second caller waits and reads the incremented value.
 *
 * The function returns the LAST number of the reserved block; the rest of the
 * block is counted back from it. Reserving a block in one call is what lets the
 * CSV import number a whole batch without going round again per row.
 *
 * Numbers reset per calendar year, which is now a fact of the counter's key
 * rather than a property of a text filter.
 */
export async function getNextDocNumbers(
  supabase: SupabaseClient,
  businessId: string,
  prefix: DocSeries,
  count: number
): Promise<string[]> {
  const year = new Date().getFullYear();

  const { data, error } = await supabase.rpc("reserve_doc_numbers", {
    p_business_id: businessId,
    p_prefix: prefix,
    p_year: year,
    p_count: count,
  });
  if (error) throw error;

  const last = Number(data);
  if (!Number.isFinite(last) || last < count) {
    throw new Error(`Could not reserve ${prefix} numbers`);
  }

  const first = last - count + 1;
  return Array.from({ length: count }, (_, i) => `${prefix}-${year}-${String(first + i).padStart(4, "0")}`);
}
