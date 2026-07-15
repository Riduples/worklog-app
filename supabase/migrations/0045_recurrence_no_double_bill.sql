-- The template invoice is itself the first billing event. If next_run_date is
-- set to the template's own issue_date, the first cron run emits a duplicate
-- for that same period — a silent double-bill of a real customer.
--
-- Make that unrepresentable rather than relying on every caller to get it
-- right: a template's next run must be strictly after its own issue date.
ALTER TABLE invoices ADD CONSTRAINT invoices_recurrence_after_issue_check
  CHECK (recurrence = 'none' OR next_run_date > issue_date);
