-- 0054 let an owner downgrade through update_business_plan while a live
-- subscription still said something else. Caught by doing it: plan went to
-- 'solo' with the subscription still tier='business', status='active'.
--
-- That is the exact drift 0054's trigger was built to prevent, reintroduced
-- through the side door. Two problems, one worse than the other:
--
--   * The trigger syncs plan FROM subscriptions, so the next ITN would have
--     silently shoved them back up to Business.
--   * Far worse once money is real: PayFast would carry on charging R199 for
--     Business while the app had quietly moved them to Solo. A billing system
--     that disagrees with the thing it bills for is not a display bug.
--
-- So while a subscription is live, the subscription is the only thing that may
-- move the plan. update_business_plan refuses rather than creating a state
-- nobody can reconcile. Changing tier or cancelling has to go through PayFast
-- (its own flow, with the ITN writing subscriptions and the trigger following)
-- because only PayFast can actually stop the money.
--
-- No subscription -> update_business_plan stays the path, still downgrade-only.
CREATE OR REPLACE FUNCTION public.update_business_plan(target_business_id uuid, new_plan text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  current_plan text;
BEGIN
  IF new_plan NOT IN ('shoebox', 'solo', 'business') THEN
    RAISE EXCEPTION 'Invalid plan';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM business_members
    WHERE business_id = target_business_id AND user_id = auth.uid() AND role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Only an owner can change the plan';
  END IF;

  IF EXISTS (
    SELECT 1 FROM subscriptions s
    WHERE s.business_id = target_business_id AND s.status IN ('active', 'past_due')
  ) AND NOT is_platform_admin() THEN
    RAISE EXCEPTION 'This business has a live subscription — change or cancel it there, so the billing and the plan stay in step'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT bp.plan INTO current_plan FROM business_profiles bp WHERE bp.id = target_business_id;

  IF plan_rank(new_plan) > plan_rank(current_plan) AND NOT is_platform_admin() THEN
    RAISE EXCEPTION 'Upgrading requires payment — start a subscription instead'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  UPDATE business_profiles SET plan = new_plan, updated_at = now() WHERE id = target_business_id;
END;
$$;
