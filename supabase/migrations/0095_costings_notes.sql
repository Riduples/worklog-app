-- 0095: optional notes/scope on a costing (v126 parity). Additive, nullable.
ALTER TABLE public.costings ADD COLUMN IF NOT EXISTS notes TEXT;
