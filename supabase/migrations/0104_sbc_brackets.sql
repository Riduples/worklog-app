-- 0104 — SBC (Small Business Corporation) sliding scale.
--
-- Business income tax was computed one of two ways (src/lib/taxRates.ts,
-- ProvTaxView): the flat COMPANY_TAX_RATE for a company, or the individual PAYE
-- tables for a sole proprietor. Neither is the reduced sliding scale a qualifying
-- Small Business Corporation is entitled to under s12E — a 0% band up to the tax
-- threshold, then 7% / 21% / 27% — so an SBC was being over-taxed from the first
-- rand of profit. This adds the scale as its own bracket set, mirroring
-- paye_brackets: one JSONB column, admin-editable per tax year.

alter table tax_rates
  add column if not exists sbc_brackets jsonb;

-- Backfill every existing row with the 2026/27 SBC table (verified against SARS's
-- published rates). The column is new, so historical/future rows start from the
-- current known scale; a platform admin adjusts any year that differs via the
-- SARS-rates editor. Only rows still missing the value are touched, so a re-run
-- can't clobber an edit.
update tax_rates
set sbc_brackets =
  '[{"from":0,"base":0,"rate":0},{"from":99000,"base":0,"rate":0.07},{"from":365000,"base":18620,"rate":0.21},{"from":550000,"base":57470,"rate":0.27}]'::jsonb
where sbc_brackets is null;

-- Now that every row carries a value, match paye_brackets: required, never null.
alter table tax_rates
  alter column sbc_brackets set not null;
