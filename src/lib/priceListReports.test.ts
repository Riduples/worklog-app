import { describe, expect, it } from "vitest";
import { aggregateCostingDrift, aggregateMargins, aggregateReorder, aggregateStockOnHand } from "./priceListReports";
import type { StockItem } from "@/lib/supabase/hooks/useStock";
import type { Costing } from "@/lib/supabase/hooks/useCostings";

const item = (i: Partial<StockItem>): StockItem =>
  ({ id: "s1", name: "Cement 50kg", item_type: "material", qty: 0, cost_price: 0, sell_price: 0, reorder_level: 0, margin_pct: 0, source_costing_id: null, ...i }) as StockItem;

const costing = (c: Partial<Costing>): Costing =>
  ({ id: "c1", name: "Wall panel", total_cost: 0, markup_pct: 0, suggested_price: 0, ...c }) as Costing;

describe("aggregateStockOnHand", () => {
  it("values what is held at cost and at sell price", () => {
    const { rows, totals } = aggregateStockOnHand([
      item({ id: "1", name: "Cement", qty: 20, cost_price: 85, sell_price: 120 }),
      item({ id: "2", name: "Paint", item_type: "product", qty: 5, cost_price: 200, sell_price: 300 }),
    ]);
    expect(rows[0]).toMatchObject({ name: "Cement", atCost: 1700, atSell: 2400 });
    expect(totals).toMatchObject({ items: 2, units: 25, atCost: 2700, atSell: 3900, potential: 1200 });
  });

  it("leaves out anything that doesn't carry stock", () => {
    const { rows, totals } = aggregateStockOnHand([
      item({ id: "1", item_type: "service", qty: 99, cost_price: 10 }),
      item({ id: "2", item_type: "labour", qty: 99, cost_price: 10 }),
      item({ id: "3", item_type: "product", qty: 2, cost_price: 10 }),
    ]);
    expect(rows).toHaveLength(1);
    expect(totals.atCost).toBe(20);
  });

  it("ranks by what the holding is worth", () => {
    const { rows } = aggregateStockOnHand([
      item({ id: "1", name: "Cheap", qty: 1, cost_price: 5 }),
      item({ id: "2", name: "Dear", qty: 1, cost_price: 500 }),
    ]);
    expect(rows.map((r) => r.name)).toEqual(["Dear", "Cheap"]);
  });
});

describe("aggregateMargins", () => {
  it("works out margin on the sell price and markup on the cost", () => {
    const { rows } = aggregateMargins([item({ cost_price: 75, sell_price: 100 })]);
    expect(rows[0].marginPct).toBe(25);
    expect(rows[0].markupPct).toBeCloseTo(33.333, 2);
    expect(rows[0].profit).toBe(25);
  });

  it("flags an item selling at or below cost", () => {
    const { rows, totals } = aggregateMargins([
      item({ id: "1", name: "Loss", cost_price: 120, sell_price: 100 }),
      item({ id: "2", name: "Break even", cost_price: 100, sell_price: 100 }),
      item({ id: "3", name: "Fine", cost_price: 50, sell_price: 100 }),
    ]);
    expect(totals.atRisk).toBe(2);
    expect(rows[0].name).toBe("Loss");
  });

  it("separates an unpriced item from a bad margin", () => {
    const { rows, totals } = aggregateMargins([item({ cost_price: 50, sell_price: 0 })]);
    expect(rows[0]).toMatchObject({ unpriced: true, atRisk: false });
    expect(totals.unpriced).toBe(1);
    expect(totals.priced).toBe(0);
  });

  it("averages each item's margin, not the margin of the totals", () => {
    const { totals } = aggregateMargins([
      item({ id: "1", cost_price: 50, sell_price: 100 }), // 50%
      item({ id: "2", cost_price: 9000, sell_price: 10000 }), // 10%
    ]);
    expect(totals.averageMargin).toBe(30);
  });

  it("recomputes rather than trusting a stored margin_pct", () => {
    const { rows } = aggregateMargins([item({ cost_price: 50, sell_price: 100, margin_pct: 99 })]);
    expect(rows[0].marginPct).toBe(50);
  });
});

describe("aggregateReorder", () => {
  it("lists what is at or under its reorder level, with the shortfall", () => {
    const { rows, totals } = aggregateReorder([
      item({ id: "1", name: "Low", qty: 2, reorder_level: 5, cost_price: 10 }),
      item({ id: "2", name: "Fine", qty: 50, reorder_level: 5 }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: "Low", shortBy: 3, costToRestock: 30 });
    expect(totals.costToRestock).toBe(30);
  });

  it("counts an item exactly on its level as needing a reorder", () => {
    expect(aggregateReorder([item({ qty: 5, reorder_level: 5 })]).rows).toHaveLength(1);
  });

  it("ignores an item with no reorder level set", () => {
    expect(aggregateReorder([item({ qty: 0, reorder_level: 0 })]).rows).toHaveLength(0);
  });

  it("puts what has run out at the top", () => {
    const { rows, totals } = aggregateReorder([
      item({ id: "1", name: "Low", qty: 4, reorder_level: 20 }),
      item({ id: "2", name: "Gone", qty: 0, reorder_level: 5 }),
    ]);
    expect(rows[0].name).toBe("Gone");
    expect(totals.outOfStock).toBe(1);
  });
});

describe("aggregateCostingDrift", () => {
  it("compares a costing's suggested price with what the linked item sells for", () => {
    const { rows, totals } = aggregateCostingDrift(
      [costing({ id: "c1", name: "Panel", total_cost: 80, markup_pct: 50, suggested_price: 120 })],
      [item({ id: "s1", name: "Panel", sell_price: 95, source_costing_id: "c1" })]
    );
    expect(rows[0]).toMatchObject({ linked: true, listedPrice: 95, difference: -25, under: true });
    expect(rows[0].differencePct).toBeCloseTo(-20.833, 2);
    expect(totals).toMatchObject({ linked: 1, under: 1, shortfall: 25 });
  });

  it("treats a rand of rounding as no drift", () => {
    const { totals } = aggregateCostingDrift(
      [costing({ id: "c1", suggested_price: 120 })],
      [item({ sell_price: 119.5, source_costing_id: "c1" })]
    );
    expect(totals.under).toBe(0);
  });

  it("keeps an unlinked costing in the list without judging its price", () => {
    const { rows, totals } = aggregateCostingDrift([costing({ id: "c1", suggested_price: 120 })], []);
    expect(rows[0]).toMatchObject({ linked: false, listedPrice: null, under: false, difference: 0 });
    expect(totals).toMatchObject({ costings: 1, linked: 0, under: 0 });
  });

  it("puts the prices that have drifted under first", () => {
    const { rows } = aggregateCostingDrift(
      [costing({ id: "c1", name: "Fine", suggested_price: 100 }), costing({ id: "c2", name: "Under", suggested_price: 100 })],
      [item({ id: "s1", sell_price: 150, source_costing_id: "c1" }), item({ id: "s2", sell_price: 60, source_costing_id: "c2" })]
    );
    expect(rows[0].name).toBe("Under");
  });
});
