-- 0106 — SARS tax classification of the business.
--
-- Worklog already persisted an informal TRADE category (business_profiles.
-- business_type: salon/retail/food/... — migration 0050), but that only decides
-- which tools show on the home screen. It never recorded the business's SARS TAX
-- classification. The provisional-tax screen asked for an entity type but threw
-- the answer away (local React state), so nothing else in the app — least of all
-- the Compliance Dashboard — could tell a sole proprietor from a company, and so
-- everyone was shown the same obligations regardless of legal form.
--
-- This records that classification on three independent axes SARS itself uses:
--
--   tax_entity_type — the LEGAL FORM. Decides which annual return applies (ITR12
--     for a sole proprietor / partnership, ITR14 for a company / CC / co-op,
--     IT12TR for a trust), whether CIPC returns are owed, and how income tax is
--     worked out. Nullable: every existing business keeps NULL and the app falls
--     back to exactly its current behaviour until the owner picks a form.
--
--   is_sbc — a company / CC / co-op that qualifies as a Small Business
--     Corporation (s12E) is taxed on a reduced sliding scale instead of the flat
--     company rate. That is a REGIME the entity elects into, not a separate kind
--     of entity, so it is a flag layered on tax_entity_type — never one of its
--     values. Meaningless for a sole proprietor / partnership / trust.
--
--   on_turnover_tax — a micro business below the Sixth Schedule ceiling can
--     register for Turnover Tax, a single simplified tax that replaces income
--     tax, provisional tax, CGT and dividends tax. Also a regime flag.
--
-- SBC and Turnover Tax are mutually exclusive — turnover tax already replaces the
-- income tax the SBC scale would otherwise reduce — so a CHECK forbids both.
--
-- All three columns are nullable/defaulted, so every business that existed
-- before this migration is untouched and behaves exactly as it did.

alter table business_profiles
  add column if not exists tax_entity_type text,
  add column if not exists is_sbc boolean not null default false,
  add column if not exists on_turnover_tax boolean not null default false;

alter table business_profiles
  drop constraint if exists business_profiles_tax_entity_type_check;
alter table business_profiles
  add constraint business_profiles_tax_entity_type_check
  check (tax_entity_type is null or tax_entity_type in
    ('sole_proprietor', 'partnership', 'company', 'close_corporation', 'co_operative', 'trust'));

alter table business_profiles
  drop constraint if exists business_profiles_tax_regime_check;
alter table business_profiles
  add constraint business_profiles_tax_regime_check
  check (not (is_sbc and on_turnover_tax));
