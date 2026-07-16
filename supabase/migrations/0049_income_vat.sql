-- VAT on cash income.
--
-- Quotes/invoices/POs/supplier invoices all snapshot the rate that applied when
-- the document was issued; income had nothing, so for a VAT-registered business
-- a cash sale overstated revenue on Profit & Loss by the VAT, and Vat201View
-- never saw it at all (output VAT summed invoices only) -- i.e. under-declared.
--
-- NOTE THE DIRECTION, it is the opposite of invoices:
--   invoices: invoice_amount is EXCLUSIVE, total = invoice_amount + vat_amount
--   income:   amount is GROSS (cash actually received), net = amount - vat_amount
--
-- income.amount has always meant "money that arrived" -- the bank-statement
-- import writes the real transaction amount and cannot know an ex-VAT figure --
-- so VAT is the portion contained within it, not something added on top.
--
-- Defaulting vat_amount to 0 keeps every existing row (and every non-VAT
-- business) meaning exactly what it meant before: net == amount.
ALTER TABLE income
  ADD COLUMN IF NOT EXISTS vat_rate NUMERIC(5,4),
  ADD COLUMN IF NOT EXISTS vat_amount NUMERIC(12,2) NOT NULL DEFAULT 0;

-- VAT can never exceed the cash it was contained in.
ALTER TABLE income
  DROP CONSTRAINT IF EXISTS income_vat_within_amount_check;
ALTER TABLE income
  ADD CONSTRAINT income_vat_within_amount_check
  CHECK (vat_amount >= 0 AND vat_amount <= amount);
