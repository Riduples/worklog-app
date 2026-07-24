-- Per-business monthly AI-usage cap for Quick Log (and any future AI route).
-- Sits alongside the hourly api_rate_limits abuse limiter (0058): this is the
-- tier PACKAGING cap. Solo 150 / Trade 500 / Structured unlimited AI logs per SA
-- calendar month, per BUSINESS (one pool shared across staff logins). The cap
-- numbers live here (the authority) AND in src/lib/tiers.ts ENTITLEMENTS.monthlyAiLogs
-- (client courtesy for display) — keep the two in step, same as maxMembers/plan_allows.
--
-- NOTE: this was applied to the live project via the Supabase MCP as two steps
-- (ai_usage_monthly_quota + a search_path pin on ai_monthly_cap); this file is the
-- consolidated final state, so a fresh apply lands in one shot.

CREATE TABLE IF NOT EXISTS public.ai_usage_monthly (
  business_id   uuid    NOT NULL REFERENCES public.business_profiles(id) ON DELETE CASCADE,
  route         text    NOT NULL,
  period        text    NOT NULL,               -- 'YYYY-MM' in Africa/Johannesburg
  request_count integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (business_id, route, period)
);

-- Deny-all direct access: only the SECURITY DEFINER functions below touch this
-- table (same shape as api_rate_limits). Enabling RLS with no policy blocks the
-- authenticated/anon roles from reading or writing it directly.
ALTER TABLE public.ai_usage_monthly ENABLE ROW LEVEL SECURITY;

-- The cap for a plan. NULL = unlimited. Mirrors tiers.ts; a rename or reprice
-- changes both. Kept as a plain function so both RPCs share one source.
CREATE OR REPLACE FUNCTION public.ai_monthly_cap(p_plan text)
 RETURNS integer
 LANGUAGE sql IMMUTABLE
 SET search_path TO 'public', 'pg_catalog'
AS $function$
  SELECT CASE p_plan
    WHEN 'solo'  THEN 150
    WHEN 'trade' THEN 500
    ELSE NULL           -- structured, and any unknown plan, = unlimited
  END;
$function$;

-- Resolve the caller's business + plan, then read this month's usage WITHOUT
-- incrementing. Drives the "X of 150 left this month" display so the number
-- shown always matches what consume_ai_quota() enforces.
CREATE OR REPLACE FUNCTION public.get_ai_quota(p_route text)
 RETURNS jsonb
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_user     uuid := auth.uid();
  v_business uuid;
  v_plan     text;
  v_limit    integer;
  v_period   text := to_char((now() AT TIME ZONE 'Africa/Johannesburg'), 'YYYY-MM');
  v_reset    timestamptz := (date_trunc('month', now() AT TIME ZONE 'Africa/Johannesburg') + interval '1 month') AT TIME ZONE 'Africa/Johannesburg';
  v_count    integer;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('unlimited', true, 'limit', NULL, 'used', 0, 'remaining', NULL, 'reset_at', v_reset);
  END IF;

  SELECT business_id INTO v_business FROM business_members WHERE user_id = v_user LIMIT 1;
  IF v_business IS NULL THEN
    RETURN jsonb_build_object('unlimited', true, 'limit', NULL, 'used', 0, 'remaining', NULL, 'reset_at', v_reset);
  END IF;

  SELECT plan INTO v_plan FROM business_profiles WHERE id = v_business;
  v_limit := ai_monthly_cap(v_plan);

  SELECT request_count INTO v_count FROM ai_usage_monthly
    WHERE business_id = v_business AND route = p_route AND period = v_period;
  v_count := COALESCE(v_count, 0);

  IF v_limit IS NULL THEN
    RETURN jsonb_build_object('unlimited', true, 'limit', NULL, 'used', v_count, 'remaining', NULL, 'reset_at', v_reset);
  END IF;

  RETURN jsonb_build_object(
    'unlimited', false,
    'limit',     v_limit,
    'used',      v_count,
    'remaining', GREATEST(0, v_limit - v_count),
    'reset_at',  v_reset
  );
END;
$function$;

-- Enforce + consume one AI call against the business's monthly pool. Called by
-- the route AFTER the hourly limiter, BEFORE the model. Denies WITHOUT
-- incrementing once at the cap (so the count never overshoots and a blocked call
-- costs nothing). Unlimited plans always allow but still count, for reporting.
CREATE OR REPLACE FUNCTION public.consume_ai_quota(p_route text)
 RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_user     uuid := auth.uid();
  v_business uuid;
  v_plan     text;
  v_limit    integer;
  v_period   text := to_char((now() AT TIME ZONE 'Africa/Johannesburg'), 'YYYY-MM');
  v_reset    timestamptz := (date_trunc('month', now() AT TIME ZONE 'Africa/Johannesburg') + interval '1 month') AT TIME ZONE 'Africa/Johannesburg';
  v_count    integer;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT business_id INTO v_business FROM business_members WHERE user_id = v_user LIMIT 1;
  -- No business row (shouldn't happen for a logged-in Quick Log user) — fail open.
  IF v_business IS NULL THEN
    RETURN jsonb_build_object('allowed', true, 'unlimited', true, 'limit', NULL, 'used', 0, 'remaining', NULL, 'reset_at', v_reset);
  END IF;

  SELECT plan INTO v_plan FROM business_profiles WHERE id = v_business;
  v_limit := ai_monthly_cap(v_plan);

  IF v_limit IS NOT NULL THEN
    SELECT request_count INTO v_count FROM ai_usage_monthly
      WHERE business_id = v_business AND route = p_route AND period = v_period;
    v_count := COALESCE(v_count, 0);
    IF v_count >= v_limit THEN
      RETURN jsonb_build_object('allowed', false, 'unlimited', false, 'limit', v_limit, 'used', v_count, 'remaining', 0, 'reset_at', v_reset);
    END IF;
  END IF;

  INSERT INTO ai_usage_monthly AS u (business_id, route, period, request_count)
  VALUES (v_business, p_route, v_period, 1)
  ON CONFLICT (business_id, route, period)
  DO UPDATE SET request_count = u.request_count + 1, updated_at = now()
  RETURNING u.request_count INTO v_count;

  RETURN jsonb_build_object(
    'allowed',   true,
    'unlimited', v_limit IS NULL,
    'limit',     v_limit,
    'used',      v_count,
    'remaining', CASE WHEN v_limit IS NULL THEN NULL ELSE GREATEST(0, v_limit - v_count) END,
    'reset_at',  v_reset
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_ai_quota(text) FROM public, anon;
REVOKE ALL ON FUNCTION public.consume_ai_quota(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_ai_quota(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.consume_ai_quota(text) TO authenticated;
