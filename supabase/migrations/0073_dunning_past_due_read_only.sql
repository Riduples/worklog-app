-- 0073 — dunning: move a lapsed paid subscription active -> past_due -> read_only.
--
-- The gap this closes: the only writer of subscriptions.status is the PayFast ITN
-- handler, which on a COMPLETE payment upserts status='active' and pushes
-- current_period_end a month out, and does nothing on a failed/non-COMPLETE ITN.
-- So a FAILED renewal leaves the row 'active' with current_period_end in the past
-- forever — the customer keeps full access without paying. Nothing ever set the
-- 'past_due' status the schema already allows.
--
-- This adds a nightly job that reads that lapse from the data (no reliance on a
-- "failed" ITN ever arriving):
--   active  -> past_due   when the paid period has ended with no renewal
--   past_due -> read_only after a 7-day grace window
-- A successful (late) payment recovers automatically: the ITN sets status='active'
-- and moves current_period_end into the future, so neither rule matches it again.
--
-- past_due is a deliberate GRACE state, NOT read-only: business_is_writable() only
-- blocks 'read_only' and expired trials, and sync_plan_from_subscription keeps the
-- tier for past_due AND read_only — so a business in grace keeps full access, and
-- once it flips to read_only it can still VIEW its records (writes blocked) exactly
-- like a lapsed trial. PayFast retries failed debit orders over a few days, and
-- cutting someone off mid-retry over a temporary bank glitch loses a customer to
-- fix nothing, which is what the grace window is for.

CREATE OR REPLACE FUNCTION public.run_dunning()
RETURNS TABLE(moved_to_past_due integer, moved_to_read_only integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_past_due          integer := 0;
  v_read_only         integer := 0;
  v_grace_days constant integer := 7;
BEGIN
  -- read_only FIRST, from rows that have already sat in past_due past the grace
  -- window, so a row that only just lapsed can't be rushed active->read_only in a
  -- single run: it enters past_due below and waits out its own grace next.
  UPDATE subscriptions
     SET status = 'read_only'
   WHERE status = 'past_due'
     AND current_period_end IS NOT NULL
     AND current_period_end < now() - (v_grace_days * interval '1 day');
  GET DIAGNOSTICS v_read_only = ROW_COUNT;

  -- A paid subscription whose period has ended with no renewal ITN -> past_due.
  UPDATE subscriptions
     SET status = 'past_due'
   WHERE status = 'active'
     AND current_period_end IS NOT NULL
     AND current_period_end < now();
  GET DIAGNOSTICS v_past_due = ROW_COUNT;

  RETURN QUERY SELECT v_past_due, v_read_only;
END;
$$;

-- Called only by pg_cron (runs as the job owner) and the service role. Never
-- reachable by a signed-in user — a client that could flip its own status could
-- undo its own dunning.
REVOKE EXECUTE ON FUNCTION public.run_dunning() FROM PUBLIC, anon, authenticated;

-- Nightly at 03:00 UTC — after expire-trials (02:30) and the recurring-invoice
-- run (01:15). Idempotent re-registration, matching the expire-trials pattern.
DO $$
BEGIN
  PERFORM cron.unschedule('run-dunning');
EXCEPTION WHEN OTHERS THEN
  NULL; -- no existing job to remove
END $$;

SELECT cron.schedule('run-dunning', '0 3 * * *', $$SELECT public.run_dunning();$$);
