-- Let a cash purchase carry its VAT, so it can be claimed.
--
-- Output VAT has always been captured on both sides of a sale: an invoice holds
-- its vat_amount, and a till sale or card tap holds its own. Input VAT only ever
-- came off supplier invoices. So a VAT-registered business that paid cash for
-- cement, or tapped a card at the fuel station, silently forfeited the input VAT
-- on every one of those purchases — the VAT201 could only claim what happened to
-- arrive as a supplier invoice.
--
-- These are the exact three columns the income table already carries, with the
-- same meaning, so both directions of the return are computed the same way:
--   vat_amount       the VAT inside amount (amount is gross, as it always was)
--   vat_rate         the rate that applied when it was logged — a snapshot, never
--                    re-derived from today's rate
--   vat_supply_type  standard / zero_rated / exempt; only standard carries VAT
--
-- Additive and zero-defaulted. Every historic expense reads as carrying no VAT,
-- which is exactly what it claimed before this column existed, so no report moves
-- until someone captures VAT on a new purchase.
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS vat_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vat_rate numeric,
  ADD COLUMN IF NOT EXISTS vat_supply_type text;

COMMENT ON COLUMN public.expenses.vat_amount IS
  'The VAT inside this payment. Claimed as input VAT on the VAT201 unless the row settles a supplier invoice, which carries its own. Mirror of income.vat_amount.';
COMMENT ON COLUMN public.expenses.vat_rate IS
  'The VAT rate that applied when this expense was logged. A snapshot — never re-derive vat_amount from the current rate.';
COMMENT ON COLUMN public.expenses.vat_supply_type IS
  'standard | zero_rated | exempt. Only a standard-rated purchase carries claimable VAT.';
