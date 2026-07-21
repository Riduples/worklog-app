-- 0068: an optional account number on bank_accounts, so an uploaded statement can
-- be matched to the right account automatically. Last 4 digits are enough to
-- match; we never require or display the full number.
ALTER TABLE bank_accounts ADD COLUMN account_number text;
