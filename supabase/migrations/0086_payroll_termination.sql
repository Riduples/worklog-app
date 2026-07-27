-- 0086 (Phase D4): termination / offboarding fields on the staff register.
--
-- Ending someone's employment: their last day, why they left (UI-19 needs the
-- reason), and whether notice was worked. Terminated staff are NOT deleted — they
-- stay on the register (sorted to the bottom, dimmed) so a final pay run can still
-- be processed, and their exit is kept for records. "active" is simply the inverse
-- of terminated, so it isn't stored.

ALTER TABLE staff_register
  ADD COLUMN terminated boolean NOT NULL DEFAULT false,
  ADD COLUMN term_end_date date,
  ADD COLUMN term_reason text,
  ADD COLUMN term_notice_worked boolean;
