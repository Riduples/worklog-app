-- 0119 — COIDA / OID annual earnings threshold.
--
-- The COIDA Return of Earnings (CoidaView) caps EACH employee's declarable
-- earnings at the Department of Employment & Labour's annual OID maximum before
-- they're summed. That limit is a Labour figure (not a SARS one), it changes each
-- year by Government Gazette, and the app had nowhere to hold it — so the Return
-- of Earnings could only show uncapped gross wages with a warning.
--
-- Stored as a scalar on tax_rates alongside the other yearly figures, so a
-- platform admin can set the current-year limit without a deploy, and the app
-- caps automatically. Mirrors 0107: add the column, backfill every existing row
-- with a known figure, then make it NOT NULL. Only rows still missing a value are
-- touched, so a re-run can't clobber an admin's edit.

alter table tax_rates
  add column if not exists oid_earnings_threshold numeric;

-- Backfill: the OID maximum assessable earnings per employee. R597,328 is the
-- figure gazetted for the 1 March 2024–28 Feb 2025 assessment year; it is the
-- known-good fallback. Admins should set each tax-year row to the limit gazetted
-- for that year — the Return of Earnings shows the figure it capped at, so a stale
-- value is visible rather than silent.
update tax_rates set oid_earnings_threshold = 597328 where oid_earnings_threshold is null;

alter table tax_rates
  alter column oid_earnings_threshold set not null;
