-- 0092 (Phase E5/v89): estimated labour hours on a price-list item.
--
-- A Labour item — or an item saved from a costing — can carry the hours it
-- represents. When such an item is added to a quote line, the quote can auto-suggest
-- its estimated_hours (Σ line hours), closing the loop Cost Calculator → Items →
-- Quote → Job Profitability. Nullable + additive.

ALTER TABLE stock_items
  ADD COLUMN estimated_hours numeric(8,2);
