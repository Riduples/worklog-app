// A sales line's shape is versioned only by which fields are present. New lines
// carry a single unit_price (qty × unit_price), unifying Quotes/Invoices with the
// Purchases model. Historic lines carry the old labour + materials split — and on
// that old model qty was never multiplied in, so it isn't applied to them either.
// Every reader of a sales line total must go through this one function so the two
// shapes can coexist without a data backfill.

export type SalesLineItem = {
  desc?: string;
  qty?: number;
  labour?: number;
  materials?: number;
  unit_price?: number;
  /** The revenue heading this line earns under; absent on every historic line. */
  sars_category?: string | null;
};

export function salesLineTotal(item: SalesLineItem): number {
  if (item.unit_price != null) return Number(item.qty || 1) * Number(item.unit_price || 0);
  return Number(item.labour || 0) + Number(item.materials || 0);
}

/** Sum of a set of sales lines. */
export function salesLinesSubtotal(items: SalesLineItem[]): number {
  return items.reduce((s, it) => s + salesLineTotal(it), 0);
}
