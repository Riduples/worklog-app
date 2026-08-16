// The four Price List Reports, rolled up.
//
// The Price List is the one module that reported on nothing: stock at cost was a
// single line inside Cash Flow, and low stock was a filter pill. These are the
// questions it can answer from what it already stores — what you hold, what you
// make on it, what to reorder, and whether the prices still match the costings
// they came from.

import type { StockItem } from "@/lib/supabase/hooks/useStock";
import type { Costing } from "@/lib/supabase/hooks/useCostings";
import { ITEM_TYPE_META, normaliseItemType, type ItemType } from "@/lib/itemTypes";

const num = (v: unknown) => Number(v || 0);

/** Only products and materials carry a count — a service has no stock to value. */
export const tracksStock = (item: StockItem) => ITEM_TYPE_META[normaliseItemType(item.item_type)].showStock;

// ── Stock on hand ────────────────────────────────────────────────────────────

export type StockValueRow = {
  id: string;
  name: string;
  itemType: ItemType;
  typeLabel: string;
  qty: number;
  costPrice: number;
  sellPrice: number;
  atCost: number;
  atSell: number;
};

export type StockValueTotals = {
  items: number;
  units: number;
  atCost: number;
  atSell: number;
  /** What the stock would earn if it all sold at the listed price. */
  potential: number;
};

export function aggregateStockOnHand(items: StockItem[]): { rows: StockValueRow[]; totals: StockValueTotals } {
  const rows: StockValueRow[] = items
    .filter(tracksStock)
    .map((i) => {
      const qty = num(i.qty);
      const costPrice = num(i.cost_price);
      const sellPrice = num(i.sell_price);
      const itemType = normaliseItemType(i.item_type);
      return {
        id: i.id,
        name: i.name,
        itemType,
        typeLabel: ITEM_TYPE_META[itemType].label,
        qty,
        costPrice,
        sellPrice,
        atCost: qty * costPrice,
        atSell: qty * sellPrice,
      };
    })
    .sort((a, b) => b.atCost - a.atCost || a.name.localeCompare(b.name));

  const atCost = rows.reduce((s, r) => s + r.atCost, 0);
  const atSell = rows.reduce((s, r) => s + r.atSell, 0);

  return {
    rows,
    totals: {
      items: rows.length,
      units: rows.reduce((s, r) => s + r.qty, 0),
      atCost,
      atSell,
      potential: atSell - atCost,
    },
  };
}

// ── Margins ──────────────────────────────────────────────────────────────────

export type MarginRow = {
  id: string;
  name: string;
  typeLabel: string;
  costPrice: number;
  sellPrice: number;
  /** Profit as a share of the sell price, 0–100. */
  marginPct: number;
  /** Profit as a share of the cost, which is what "markup" means to a supplier. */
  markupPct: number;
  profit: number;
  /** Selling at or below what it cost — the row worth acting on. */
  atRisk: boolean;
  /** No sell price set, so there is nothing to judge yet. */
  unpriced: boolean;
};

export type MarginTotals = { items: number; priced: number; atRisk: number; unpriced: number; averageMargin: number };

export function aggregateMargins(items: StockItem[]): { rows: MarginRow[]; totals: MarginTotals } {
  const rows: MarginRow[] = items
    .map((i) => {
      const costPrice = num(i.cost_price);
      const sellPrice = num(i.sell_price);
      const profit = sellPrice - costPrice;
      const unpriced = sellPrice <= 0;
      return {
        id: i.id,
        name: i.name,
        typeLabel: ITEM_TYPE_META[normaliseItemType(i.item_type)].label,
        costPrice,
        sellPrice,
        // Recomputed rather than read from margin_pct: that column is written at
        // save time and an item edited elsewhere could carry a stale one.
        marginPct: sellPrice > 0 ? (profit / sellPrice) * 100 : 0,
        markupPct: costPrice > 0 ? (profit / costPrice) * 100 : 0,
        profit,
        atRisk: !unpriced && profit <= 0,
        unpriced,
      };
    })
    // Worst margin first — the point of the report is what needs attention.
    .sort((a, b) => Number(b.unpriced) - Number(a.unpriced) || a.marginPct - b.marginPct || a.name.localeCompare(b.name));

  const priced = rows.filter((r) => !r.unpriced);
  return {
    rows,
    totals: {
      items: rows.length,
      priced: priced.length,
      atRisk: rows.filter((r) => r.atRisk).length,
      unpriced: rows.filter((r) => r.unpriced).length,
      // The average of each item's margin, not the margin of the totals — one
      // expensive item shouldn't drown out the rest of the list.
      averageMargin: priced.length ? priced.reduce((s, r) => s + r.marginPct, 0) / priced.length : 0,
    },
  };
}

// ── Reorder list ─────────────────────────────────────────────────────────────

export type ReorderRow = {
  id: string;
  name: string;
  typeLabel: string;
  qty: number;
  reorderLevel: number;
  /** How many units short of the level — what to buy. */
  shortBy: number;
  costPrice: number;
  costToRestock: number;
  outOfStock: boolean;
};

export function aggregateReorder(items: StockItem[]): { rows: ReorderRow[]; totals: { items: number; outOfStock: number; costToRestock: number } } {
  const rows: ReorderRow[] = items
    .filter(tracksStock)
    // A reorder level of 0 means nobody set one, so there is no line to be under.
    .filter((i) => num(i.reorder_level) > 0 && num(i.qty) <= num(i.reorder_level))
    .map((i) => {
      const qty = num(i.qty);
      const reorderLevel = num(i.reorder_level);
      const shortBy = Math.max(0, reorderLevel - qty);
      const costPrice = num(i.cost_price);
      return {
        id: i.id,
        name: i.name,
        typeLabel: ITEM_TYPE_META[normaliseItemType(i.item_type)].label,
        qty,
        reorderLevel,
        shortBy,
        costPrice,
        costToRestock: shortBy * costPrice,
        outOfStock: qty <= 0,
      };
    })
    .sort((a, b) => Number(b.outOfStock) - Number(a.outOfStock) || b.shortBy - a.shortBy || a.name.localeCompare(b.name));

  return {
    rows,
    totals: {
      items: rows.length,
      outOfStock: rows.filter((r) => r.outOfStock).length,
      costToRestock: rows.reduce((s, r) => s + r.costToRestock, 0),
    },
  };
}

// ── Costings vs price list ───────────────────────────────────────────────────

export type CostingDriftRow = {
  id: string;
  name: string;
  totalCost: number;
  markupPct: number;
  suggestedPrice: number;
  /** The price list item this costing produced, if it is still linked. */
  itemName: string;
  listedPrice: number | null;
  /** Listed less suggested — negative means you're charging under the costing. */
  difference: number;
  differencePct: number;
  linked: boolean;
  under: boolean;
};

export function aggregateCostingDrift(
  costings: Costing[],
  items: StockItem[]
): { rows: CostingDriftRow[]; totals: { costings: number; linked: number; under: number; shortfall: number } } {
  const rows: CostingDriftRow[] = costings
    .map((c) => {
      const item = items.find((i) => i.source_costing_id === c.id);
      const suggestedPrice = num(c.suggested_price);
      const listedPrice = item ? num(item.sell_price) : null;
      const difference = listedPrice == null ? 0 : listedPrice - suggestedPrice;
      return {
        id: c.id,
        name: c.name,
        totalCost: num(c.total_cost),
        markupPct: num(c.markup_pct),
        suggestedPrice,
        itemName: item?.name ?? "",
        listedPrice,
        difference,
        differencePct: suggestedPrice > 0 && listedPrice != null ? (difference / suggestedPrice) * 100 : 0,
        linked: !!item,
        // A rand of rounding isn't drift; anything more is a price that has
        // drifted from the costing behind it.
        under: listedPrice != null && difference < -1,
      };
    })
    .sort((a, b) => Number(b.under) - Number(a.under) || a.difference - b.difference || a.name.localeCompare(b.name));

  return {
    rows,
    totals: {
      costings: rows.length,
      linked: rows.filter((r) => r.linked).length,
      under: rows.filter((r) => r.under).length,
      // What you give away per sale across everything priced under its costing.
      shortfall: rows.filter((r) => r.under).reduce((s, r) => s - r.difference, 0),
    },
  };
}
