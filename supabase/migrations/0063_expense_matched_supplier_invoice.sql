-- Let an expense point at the supplier invoice it settles.
--
-- The mirror of income.matched_invoice_id, and the twin of 0060's
-- matched_ledger_entry_id. Profit & Loss now counts a supplier invoice as a cost
-- the moment it is issued (accrual), exactly as it counts a customer invoice as
-- revenue when issued. So the cash expense that later pays that invoice must be
-- left out of costs, or the bill and its payment read as double the cost — the
-- same trap the income side fixed by naming the invoice a payment settles.
--
-- Why this exists alongside matched_ledger_entry_id: the app has two ways to
-- record a payable — the informal credit book (ledger_entries) and formal
-- supplier invoices. 0060 wired the ledger into P&L; supplier invoices, the
-- richer and more-used feature, were never connected at all. This closes that.
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS matched_supplier_invoice_id uuid
    REFERENCES public.supplier_invoices(id) ON DELETE SET NULL;

-- P&L asks "which expenses in this period already counted as an issued invoice",
-- so the lookup is by expense.
CREATE INDEX IF NOT EXISTS idx_expenses_matched_supplier_invoice
  ON public.expenses(matched_supplier_invoice_id)
  WHERE matched_supplier_invoice_id IS NOT NULL;

COMMENT ON COLUMN public.expenses.matched_supplier_invoice_id IS
  'The supplier invoice this expense settles. Profit & Loss subtracts these from cash expenses, because the supplier invoice already counted the cost when it was issued. Mirror of income.matched_invoice_id.';
