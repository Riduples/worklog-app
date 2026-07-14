-- create_pay_run() auto-generates wage/UIF/SDL expense rows with source =
-- 'payroll'; the existing CHECK only allowed 'manual'/'quick_log', so every
-- pay run save failed with expenses_source_check. Add 'payroll' as a third
-- recognized source value.
ALTER TABLE expenses DROP CONSTRAINT expenses_source_check;
ALTER TABLE expenses ADD CONSTRAINT expenses_source_check CHECK (source = ANY (ARRAY['manual'::text, 'quick_log'::text, 'payroll'::text]));
