-- 0070: shorten the free trial from 30 to 14 days. Two weeks builds the daily
-- habit but can't cover a full month of books, so serial-trialing yields broken
-- half-months (useless as records) while halving cost exposure per freeloader.
-- Only recreates the function body; the trg_create_trial_subscription trigger
-- picks it up by name. Existing trialing rows keep their stored 30-day
-- current_period_end — only new businesses get 14 days.
CREATE OR REPLACE FUNCTION public.create_trial_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  INSERT INTO subscriptions (business_id, tier, status, current_period_end)
  VALUES (NEW.id, 'structured', 'trialing', now() + interval '14 days')
  ON CONFLICT (business_id) DO NOTHING;
  RETURN NEW;
END;
$$;
