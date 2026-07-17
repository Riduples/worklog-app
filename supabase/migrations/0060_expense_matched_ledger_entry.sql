-- Let an expense point at the supplier ledger entry it settles.
--
-- The mirror of income.matched_invoice_id, and it closes the mirror of the bug
-- that column fixed. Profit & Loss counts costs from two sources: every expense
-- (cash), and every supplier ledger entry in the period (credit incurred).
-- Nothing connected them. Write "I owe Pipe Co R1000" in the Ledger and then
-- log the R1000 expense when you actually pay it, and the report charged you
-- R2000 for a R1000 cost.
--
-- The income side has had the answer since 3885cf2: the payment names the
-- invoice it settles, and the report leaves that payment out because the
-- invoice already counted it. Same shape here — the expense names the entry.
--
-- Nobody had hit this: production has no supplier ledger entries at all, so the
-- report has never been wrong in practice. It was waiting for the first person
-- to use the credit book properly.
--
-- Not a walk-back of 0059. Those columns pointed at quotes and purchase orders
-- for job costing and were read by nothing, here or in the prototype. This one
-- points at a ledger entry, has a reader on day one, and exists to stop a
-- number being wrong.
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS matched_ledger_entry_id uuid
    REFERENCES public.ledger_entries(id) ON DELETE SET NULL;

-- The report asks "which expenses in this period are already counted as credit",
-- so the lookup is by expense, not by entry.
CREATE INDEX IF NOT EXISTS idx_expenses_matched_ledger_entry
  ON public.expenses(matched_ledger_entry_id)
  WHERE matched_ledger_entry_id IS NOT NULL;

COMMENT ON COLUMN public.expenses.matched_ledger_entry_id IS
  'The supplier ledger entry this expense settles. Profit & Loss subtracts these from cash expenses, because the ledger entry already counted the cost when it was incurred. Mirror of income.matched_invoice_id.';
