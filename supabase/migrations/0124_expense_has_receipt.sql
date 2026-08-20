-- Record whether the owner has proof for an expense they are claiming.
--
-- SARS can ask for a slip behind any deduction, and the ones that go missing are
-- never the big ones — it is the R80 of fuel paid in cash on a Saturday. By the
-- time an assessment asks, a year has passed and nobody can tell which of four
-- hundred rows still has a slip in the bakkie.
--
-- So the question is asked once, at capture, while the answer is still known.
-- This stores only the answer. No file is uploaded and none is expected: the
-- owner keeps the slip wherever they keep slips, and this is the index that says
-- which rows have one. That keeps the promise cheap to honour — a box of paper
-- costs nothing, a storage bucket of photographs costs every month.
--
-- Defaults to false rather than null: an expense captured before this column
-- existed made no claim about proof, and false is what an unanswered question
-- means everywhere else it is read.
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS has_receipt boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.expenses.has_receipt IS
  'The owner says a receipt or proof exists for this expense, kept outside Worklog. Nothing is uploaded — this is the flag that lets an audit-readiness view find the claims with no proof behind them.';
