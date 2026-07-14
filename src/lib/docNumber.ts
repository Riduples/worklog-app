import type { SupabaseClient } from "@supabase/supabase-js";

const TABLE_BY_PREFIX = {
  QTE: "quotes",
  INV: "invoices",
  PO: "purchase_orders",
} as const;

export async function getNextDocNumber(
  supabase: SupabaseClient,
  businessId: string,
  prefix: keyof typeof TABLE_BY_PREFIX
): Promise<string> {
  const year = new Date().getFullYear();
  const table = TABLE_BY_PREFIX[prefix];
  const yearPrefix = `${prefix}-${year}-`;

  // Scoped by business (not the individual user) so every team member shares
  // one sequence — two members generating a doc number concurrently should
  // never collide within the same business.
  const { data, error } = await supabase
    .from(table)
    .select("doc_number")
    .eq("business_id", businessId)
    .like("doc_number", `${yearPrefix}%`);
  if (error) throw error;

  const maxNum = (data ?? []).reduce((max, row) => {
    const match = /(\d{4})$/.exec(row.doc_number as string);
    const n = match ? parseInt(match[1], 10) : 0;
    return n > max ? n : max;
  }, 0);

  return `${yearPrefix}${String(maxNum + 1).padStart(4, "0")}`;
}
