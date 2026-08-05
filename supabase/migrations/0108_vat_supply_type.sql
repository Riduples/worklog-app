-- 0108 — VAT supply classification on the output (sales) side.
--
-- VAT was modelled as a single rate: every sale carried vat_amount at the
-- standard 15% (or 0 when not registered). But SARS recognises three kinds of
-- supply, and the VAT201 return declares each on its own line:
--
--   standard-rated (field 1) — the standard rate
--   zero-rated     (field 2) — taxable at 0% (basic foodstuffs, exports, fuel …)
--   exempt         (field 3) — outside VAT (residential rent, financial services)
--
-- Without this a VAT-registered spaza shop — whose stock is largely zero-rated —
-- would overstate its output VAT and couldn't declare its zero-rated turnover.
--
-- Add the classification to the two output-side tables (cash income and
-- invoices). NOT NULL DEFAULT 'standard' so every existing row is treated exactly
-- as it is today (standard-rated), and only a deliberate zero-rated / exempt sale
-- differs. The input side (supplier invoices) doesn't need this — fields 1–3 are
-- about supplies made, not purchases.

alter table income
  add column if not exists vat_supply_type text not null default 'standard';
alter table income
  drop constraint if exists income_vat_supply_type_check;
alter table income
  add constraint income_vat_supply_type_check
  check (vat_supply_type in ('standard', 'zero_rated', 'exempt'));

alter table invoices
  add column if not exists vat_supply_type text not null default 'standard';
alter table invoices
  drop constraint if exists invoices_vat_supply_type_check;
alter table invoices
  add constraint invoices_vat_supply_type_check
  check (vat_supply_type in ('standard', 'zero_rated', 'exempt'));
