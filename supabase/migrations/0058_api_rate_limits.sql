-- Rate limiting for the API routes.
--
-- Three of the four call Anthropic, so every request costs real money, and the
-- fourth spawns Chromium. All four are behind auth, so the exposure isn't the
-- open internet — it's a signed-in user (or a client bug looping) running up
-- Riaan's bill. Nothing capped that.
--
-- State lives here rather than in the route because Vercel routes are
-- serverless: an in-memory counter would reset on every cold start and each
-- concurrent instance would keep its own, which is a limiter that doesn't
-- limit. Postgres is already a dependency of every one of these routes (they
-- all call auth.getUser() first), so this adds a round trip to a connection
-- that is already being made.

CREATE TABLE IF NOT EXISTS public.api_rate_limits (
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  route         text        NOT NULL,
  window_start  timestamptz NOT NULL,
  request_count integer     NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, route, window_start)
);

-- Nothing reaches this table directly — only consume_rate_limit() below, which
-- runs as the owner and so passes through RLS. Enabling RLS with no policies is
-- what denies everyone else; the REVOKE is belt-and-braces against Supabase's
-- default grants, which have caught this project repeatedly.
ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.api_rate_limits FROM PUBLIC, anon, authenticated;

/**
 * Counts one request against the caller's quota and says whether to allow it.
 *
 * The limits are deliberately NOT parameters. This function has to be callable
 * by `authenticated` — the routes talk to Postgres as the signed-in user, since
 * the project has no service-role key — so anything the caller passes is
 * something the caller chooses. A p_limit argument would let a client hand
 * itself any quota it liked. The policy lives here, where the user cannot reach
 * it; the route only says which route it is.
 *
 * A fixed hourly bucket, not a sliding window. It lets someone spend two
 * windows' worth across a boundary, which for a cost cap is a rounding error
 * against the simplicity of one atomic upsert.
 *
 * The count increments before the check, so a request that is already over the
 * line still counts. That is intentional: hammering a closed door shouldn't
 * reopen it sooner.
 */
CREATE OR REPLACE FUNCTION public.consume_rate_limit(p_route text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user   uuid := auth.uid();
  v_limit  integer;
  v_start  timestamptz := date_trunc('hour', now());
  v_count  integer;
BEGIN
  IF v_user IS NULL THEN
    -- The routes check auth first and never get here; refuse rather than
    -- silently count anonymous calls into one shared bucket.
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- Per user, per hour. Set well above what a real business does in an hour and
  -- well below what a runaway loop costs: the point is a ceiling, not a budget.
  v_limit := CASE p_route
    WHEN 'quick-log'       THEN 40   -- ~500 output tokens; the busiest by design
    WHEN 'help-assistant'  THEN 20   -- ~1000 output tokens
    WHEN 'parse-statement' THEN 6    -- ~8000 output tokens plus a whole PDF in; dearest by far
    WHEN 'render-pdf'      THEN 30   -- no model call, but it boots Chromium
    ELSE NULL
  END;

  IF v_limit IS NULL THEN
    -- An unknown route is a bug in the caller, not licence to skip the limit.
    RAISE EXCEPTION 'unknown rate-limited route: %', p_route;
  END IF;

  INSERT INTO public.api_rate_limits AS l (user_id, route, window_start, request_count)
  VALUES (v_user, p_route, v_start, 1)
  ON CONFLICT (user_id, route, window_start)
  DO UPDATE SET request_count = l.request_count + 1
  RETURNING l.request_count INTO v_count;

  RETURN jsonb_build_object(
    'allowed',    v_count <= v_limit,
    'limit',      v_limit,
    'remaining',  GREATEST(0, v_limit - v_count),
    'reset_at',   v_start + interval '1 hour',
    'retry_after', GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_start + interval '1 hour') - now()))::int)
  );
END;
$$;

-- The routes call this as the signed-in user, so `authenticated` needs EXECUTE.
-- A user calling it directly can only burn their own quota, which is why the
-- limits had to live inside the function rather than in its arguments.
REVOKE EXECUTE ON FUNCTION public.consume_rate_limit(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(text) TO authenticated;

/**
 * Reaps spent windows. Without this the table grows one row per user, per
 * route, per hour, forever. Yesterday's buckets can never be consulted again —
 * the current window is always date_trunc('hour', now()) — so anything older
 * than a day is dead weight.
 */
CREATE OR REPLACE FUNCTION public.purge_old_rate_limits()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.api_rate_limits WHERE window_start < now() - interval '1 day';
$$;

-- Cron-only.
REVOKE EXECUTE ON FUNCTION public.purge_old_rate_limits() FROM PUBLIC, anon, authenticated;

SELECT cron.schedule(
  'purge-old-rate-limits',
  '30 2 * * *', -- 02:30 UTC daily, clear of the 01:15 recurring-invoice run
  $$SELECT public.purge_old_rate_limits();$$
);
