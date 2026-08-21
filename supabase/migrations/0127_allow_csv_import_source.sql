-- 0127: allow 'csv_import' as an income/expense source.
--
-- The new Banking CSV import (a bank statement, or anything shaped like one,
-- uploaded rather than AI-read) tags each row source = 'csv_import' to keep its
-- provenance distinct from the AI statement reader's 'bank_statement'. But the
-- source CHECK constraints (last set in 0042) never listed it, so Postgres
-- rejected every row on insert and the whole import failed silently. Widen both
-- constraints to include it. Additive — no existing row changes, and every
-- previously-allowed value is kept.
ALTER TABLE public.income DROP CONSTRAINT IF EXISTS income_source_check;
ALTER TABLE public.income ADD CONSTRAINT income_source_check
  CHECK (source = ANY (ARRAY['manual', 'quick_log', 'bank_statement', 'csv_import']));

ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_source_check;
ALTER TABLE public.expenses ADD CONSTRAINT expenses_source_check
  CHECK (source = ANY (ARRAY['manual', 'quick_log', 'payroll', 'bank_statement', 'csv_import']));
