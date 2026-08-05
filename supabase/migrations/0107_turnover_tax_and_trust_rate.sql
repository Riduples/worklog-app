-- 0107 — Turnover Tax (Sixth Schedule) + the trust income-tax rate.
--
-- Business income tax was worked out three ways (src/lib/taxRates.ts): the flat
-- COMPANY_TAX_RATE, the individual PAYE tables, or the SBC scale (0104). Two SARS
-- classifications had nowhere to live:
--
--   * A micro business can register for TURNOVER TAX — a single simplified tax on
--     turnover that replaces income tax, provisional tax, CGT and dividends tax.
--     The 2027 year of assessment overhauled it (first change since 2009): the
--     tax-free band rose to R600,000 and the qualifying ceiling to R2.3m. Stored
--     as its own bracket set (like paye_brackets / sbc_brackets) plus the ceiling.
--
--   * A TRUST pays a flat rate (45%) distinct from the company rate. Stored as a
--     scalar alongside company_tax_rate.
--
-- Mirrors 0104: add the columns, backfill every existing row with the known-good
-- 2026/27 figures, then make them NOT NULL. Only rows still missing a value are
-- touched, so a re-run can't clobber a platform admin's edit.

alter table tax_rates
  add column if not exists turnover_tax_brackets jsonb,
  add column if not exists turnover_tax_max numeric,
  add column if not exists trust_tax_rate numeric;

-- Backfill: 2027-year-of-assessment Turnover Tax table (0% ≤ R600k, then 1/2/3%
-- up to the R2.3m ceiling), verified against SARS's published rates. Cumulative
-- bases fall out of the band widths: 1%×(950,000−600,000)=3,500;
-- 3,500+2%×(1,400,000−950,000)=12,500.
update tax_rates
set turnover_tax_brackets =
  '[{"from":0,"base":0,"rate":0},{"from":600000,"base":0,"rate":0.01},{"from":950000,"base":3500,"rate":0.02},{"from":1400000,"base":12500,"rate":0.03}]'::jsonb
where turnover_tax_brackets is null;

update tax_rates set turnover_tax_max = 2300000 where turnover_tax_max is null;
update tax_rates set trust_tax_rate = 0.45 where trust_tax_rate is null;

alter table tax_rates
  alter column turnover_tax_brackets set not null,
  alter column turnover_tax_max set not null,
  alter column trust_tax_rate set not null;
