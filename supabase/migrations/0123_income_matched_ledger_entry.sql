-- Let an income row point at the client ledger entry it settles.
--
-- This closes the last corner of the accrual model, and it is the exact mirror
-- of 0060. Profit & Loss counts costs from two sources — cash expenses, and
-- supplier ledger entries raised in the period — and 0060 gave the expense a way
-- to say "I settle that entry" so the two could not both count.
--
-- Revenue never got the same treatment. A supplier entry became a cost the
-- moment it was raised, but a CLIENT entry — "Thabo owes me R1,500" — reached
-- revenue nowhere at all. Marking it paid only flipped a status column. So the
-- credit book was symmetrical on screen and lopsided in the report: sell on
-- credit and the sale was invisible until someone happened to log the cash, buy
-- on credit and the cost landed immediately.
--
-- Counting the client entry as revenue is the fix, and this column is what makes
-- that safe rather than a new double-count: once the entry itself counts, the
-- money that arrives against it must be netted out, exactly as the expense side
-- has done since 0060. Without the link, logging the R1,500 when Thabo pays
-- would count the sale twice.
--
-- Nullable and additive. Every historic income row reads as unlinked, which is
-- what it was.
ALTER TABLE public.income
  ADD COLUMN IF NOT EXISTS matched_ledger_entry_id uuid
    REFERENCES public.ledger_entries(id) ON DELETE SET NULL;

-- The report asks "which income rows in this period are already counted as
-- credit", so the lookup is by income row, not by entry — same shape as the
-- expense index in 0060.
CREATE INDEX IF NOT EXISTS idx_income_matched_ledger_entry
  ON public.income(matched_ledger_entry_id)
  WHERE matched_ledger_entry_id IS NOT NULL;

COMMENT ON COLUMN public.income.matched_ledger_entry_id IS
  'The client ledger entry this receipt settles. Profit & Loss subtracts these from cash income, because the ledger entry already counted the revenue when the credit was extended. Mirror of expenses.matched_ledger_entry_id.';
