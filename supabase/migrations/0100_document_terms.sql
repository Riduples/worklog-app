-- 0100: customer-facing Terms & Conditions on quotes and invoices.
-- Per-document snapshot (terms) so a historical doc keeps the wording it was
-- issued with, even if the owner later changes their standard terms — same
-- snapshot rationale as vat_rate/vat_amount.
-- Business-level defaults pre-fill each new document; separate for quotes vs
-- invoices because their standard terms usually differ (quote validity /
-- pricing caveats vs payment terms / late-payment / ownership).
ALTER TABLE public.business_profiles
  ADD COLUMN IF NOT EXISTS default_quote_terms TEXT,
  ADD COLUMN IF NOT EXISTS default_invoice_terms TEXT;
ALTER TABLE public.quotes   ADD COLUMN IF NOT EXISTS terms TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS terms TEXT;
