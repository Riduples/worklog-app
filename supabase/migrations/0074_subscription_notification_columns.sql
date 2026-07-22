-- 0074 — track which billing emails have gone out, so the daily notification job
-- (Next.js /api/cron/notifications) sends each warning once and never spams.
--
--   trial_ending_notified_at — set when the "your trial ends soon" email is sent.
--   past_due_notified_at      — set when the "we couldn't take your payment" email
--                               is sent; cleared by the PayFast ITN on the next
--                               successful payment, so a future lapse warns again.
--
-- Nullable and untouched by everything else, so existing rows and the trial /
-- dunning machinery are unaffected.

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS trial_ending_notified_at timestamptz,
  ADD COLUMN IF NOT EXISTS past_due_notified_at     timestamptz;
