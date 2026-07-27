-- 0093: RLS init-plan optimisation (advisor: auth_rls_initplan).
--
-- tax_rates and announcements are read on most requests. Their SELECT policies
-- called auth.uid() directly, which Postgres re-evaluates PER ROW. Wrapping it in
-- (select auth.uid()) makes Postgres evaluate it ONCE per query. Identical
-- security semantics — purely a performance fix. Cheap to do now while small.

ALTER POLICY tax_rates_select ON public.tax_rates
  USING ((select auth.uid()) IS NOT NULL);

ALTER POLICY announcements_select_live ON public.announcements
  USING (
    (select auth.uid()) IS NOT NULL
    AND active
    AND (starts_at IS NULL OR starts_at <= now())
    AND (ends_at IS NULL OR ends_at >= now())
  );
