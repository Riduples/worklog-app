-- 0102: cost calculator units / portions (v126) — Melissa's branch.
-- Renumbered from her 0096 (that number is already taken on main by
-- 0096_income_expense_is_personal); the DB version now matches this filename.
--
-- The v126 Cost Calculator lets you cost a batch — e.g. "Chicken curry ×10" —
-- and label the unit ("portion", "job", "batch"), so the suggested price can be
-- read per unit as well as for the whole batch. Additive, non-breaking columns:
-- existing rows default to 1 unit labelled "job", i.e. the single-job costing
-- behaviour they already had.
ALTER TABLE public.costings ADD COLUMN IF NOT EXISTS units numeric(12,2) NOT NULL DEFAULT 1;
ALTER TABLE public.costings ADD COLUMN IF NOT EXISTS unit_label text NOT NULL DEFAULT 'job';
