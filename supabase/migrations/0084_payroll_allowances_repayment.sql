-- 0084 (Phase D2): recurring allowances + advance repayment plans.
--
-- A recurring allowance is a standing fact about a person's pay (travel, phone),
-- set once in the staff register and pulled into every Pay Run. An advance can
-- carry an agreed per-pay-run repayment amount that the Pay Run pre-fills (capped
-- at the outstanding balance). Both are optional and additive — blank means the
-- previous behaviour (no standing allowance / deduct advances manually).

ALTER TABLE staff_register
  ADD COLUMN recurring_allowance numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN recurring_allowance_desc text;

ALTER TABLE worker_loans
  ADD COLUMN repay_per_run numeric(12,2);
