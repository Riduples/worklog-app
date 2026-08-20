-- Mark a row as agreed to the bank.
--
-- Cash has had this check since Cash-ups: count what you hold, compare it to
-- what you logged, and the difference is the question. The bank had no
-- equivalent. Nothing recorded that a row had been seen on a statement, so
-- importing the same statement twice wrote every line a second time and the
-- balance drifted with no way to tell which of the pair was the ghost.
--
-- A timestamp rather than a boolean, for the same reason paid_date is a date and
-- not a flag: "when was this agreed" answers questions "was it agreed" cannot,
-- and un-reconciling is a null away.
--
-- All three tables, because all three move a bank balance. A transfer appears on
-- the statement exactly as a payment does — twice, in fact, once on each side —
-- and a reconciliation that could not tick it off would stall on every one.
ALTER TABLE public.income
  ADD COLUMN IF NOT EXISTS reconciled_at timestamptz;
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS reconciled_at timestamptz;
ALTER TABLE public.account_transfers
  ADD COLUMN IF NOT EXISTS reconciled_at timestamptz;

COMMENT ON COLUMN public.income.reconciled_at IS
  'When this receipt was agreed to the bank statement. Null = not yet reconciled. Reporting ignores it; it exists so a re-imported statement can be told apart from a genuine second payment.';
COMMENT ON COLUMN public.expenses.reconciled_at IS
  'When this payment was agreed to the bank statement. Null = not yet reconciled.';
COMMENT ON COLUMN public.account_transfers.reconciled_at IS
  'When this transfer was agreed to the bank statement. Null = not yet reconciled.';

-- Reconciling walks one account's unreconciled rows for a date window, so that
-- is what the index answers.
CREATE INDEX IF NOT EXISTS idx_income_unreconciled
  ON public.income(account_id, transaction_date)
  WHERE reconciled_at IS NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_unreconciled
  ON public.expenses(account_id, transaction_date)
  WHERE reconciled_at IS NULL AND deleted_at IS NULL;
