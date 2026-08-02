-- 0096: cost calculator units / portions (v126).
--
-- The v126 Cost Calculator lets you cost a batch — e.g. "Chicken curry ×10" —
-- and label the unit ("portion", "job", "batch"), so the suggested price can be
-- read per unit as well as for the whole batch. Additive, non-breaking columns:
-- existing rows default to 1 unit labelled "job", i.e. the single-job costing
-- behaviour they already had.
ALTER TABLE public.costings ADD COLUMN IF NOT EXISTS units numeric(12,2) NOT NULL DEFAULT 1;
ALTER TABLE public.costings ADD COLUMN IF NOT EXISTS unit_label text NOT NULL DEFAULT 'job';
