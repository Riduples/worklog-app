-- 0088 (Phase E5): Job Profitability — estimated hours on a quote, and a link
-- from a time entry to the quote it's being worked against.
--
-- Profitability is an honest hours-vs-hours comparison: hours logged against a
-- job vs the hours you quoted for it (not labour rands vs the whole quote, which
-- also included materials and could mislead). Both columns are optional/nullable
-- and additive — existing quotes and time entries are unaffected.

ALTER TABLE quotes
  ADD COLUMN estimated_hours numeric(8,2);

ALTER TABLE time_entries
  ADD COLUMN quote_id uuid REFERENCES quotes(id) ON DELETE SET NULL;

CREATE INDEX idx_time_entries_quote_id ON time_entries(quote_id) WHERE quote_id IS NOT NULL;
