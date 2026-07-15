-- worker_payments and chair_rentals were superseded by the v2 payroll rebuild
-- (staff_register / pay_runs / worker_loans / worker_leave). The v65 update
-- deprecated them: the daily-wage log became the full payroll system, and
-- chair rentals became an income category label rather than a feature.
--
-- Verified before dropping: 0 rows in each, no FK/view/function dependencies,
-- and no references anywhere in app code.
DROP TABLE IF EXISTS worker_payments;
DROP TABLE IF EXISTS chair_rentals;
