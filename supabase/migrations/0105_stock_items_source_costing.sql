-- 0105 (Phase E6): link a price-list item back to the costing it was priced from.
--
-- "Save this costing to your price list" used to create a fresh, standalone stock
-- item every time — re-saving after an edit silently made a duplicate, and the
-- item's price drifted out of date the moment the costing changed. This column is
-- the real link: a stock item created from a costing remembers which costing it
-- came from, so the Cost Calculator can refresh that same item in place instead of
-- duplicating, and the Items list can show "priced from a costing".
--
-- ON DELETE SET NULL: deleting a costing must not delete the price-list item you
-- sell from — it just becomes a plain, unlinked item. Nullable + additive.

ALTER TABLE stock_items
  ADD COLUMN source_costing_id uuid REFERENCES costings(id) ON DELETE SET NULL;

CREATE INDEX idx_stock_items_source_costing ON stock_items(source_costing_id);
