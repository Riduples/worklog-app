-- 0089 (Phase E3): item-type model on the price list.
--
-- Items were a flat stock record. Now each carries a type — Service / Product /
-- Labour / Material / Package — so the price list reads correctly for any trade
-- (a salon's services, a plumber's labour + materials, a shop's products) and a
-- quote/invoice line can be filled from a saved item. Every item still carries a
-- quantity regardless of type. Existing rows default to 'product'.

ALTER TABLE stock_items
  ADD COLUMN item_type text NOT NULL DEFAULT 'product'
    CHECK (item_type IN ('service', 'product', 'labour', 'material', 'package'));
