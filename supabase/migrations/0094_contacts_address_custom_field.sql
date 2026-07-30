-- 0094: contacts address + one custom field (v126 parity).
-- Address applies to both clients and suppliers; the custom label/value pair is a
-- client-only free-form tag in the UI, but the columns are type-agnostic. All
-- nullable and additive, so existing rows and RLS are unaffected.
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS custom_label TEXT,
  ADD COLUMN IF NOT EXISTS custom_value TEXT;
