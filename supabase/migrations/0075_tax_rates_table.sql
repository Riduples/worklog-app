-- 0075 — admin-editable SARS rates.
--
-- Rates were hardcoded in src/lib/taxRates.ts, so the annual Budget update meant a
-- code change + redeploy. This moves them to a table a platform admin edits once a
-- year; the app reads the row effective for today, and keeps the hardcoded values
-- as a fallback so it never breaks if the table is empty/unreachable.
--
-- These are NATIONAL figures shared by every business — deliberately NOT a
-- per-business setting. Read by any signed-in user (the payroll/tax tools need
-- them); written only by platform admins (is_platform_admin(), migration 0054).

-- ── Platform admins who may edit the rates ──────────────────────────────────
insert into platform_admins (user_id, note)
select u.id, 'Admin — ' || u.email
from auth.users u
where u.email in ('riaan@worklogsolutions.co.za', 'melissa@worklogsolutions.co.za')
on conflict (user_id) do nothing;

-- ── The rates table: one row per tax year ───────────────────────────────────
create table if not exists tax_rates (
  id                         uuid primary key default gen_random_uuid(),
  tax_year                   text not null unique,          -- e.g. '2026/27'
  effective_from             date not null,                 -- e.g. 2026-03-01
  effective_to               date not null,                 -- e.g. 2027-02-28
  paye_brackets              jsonb not null,                -- [{from,base,rate}, ...]
  primary_rebate             numeric not null,
  secondary_rebate           numeric not null,
  tertiary_rebate            numeric not null,
  paye_monthly_threshold     numeric not null,
  uif_employee_rate          numeric not null,
  uif_employer_rate          numeric not null,
  uif_ceiling                numeric not null,
  sdl_rate                   numeric not null,
  sdl_annual_threshold       numeric not null,
  company_tax_rate           numeric not null,
  medical_credit_first_two   numeric not null,
  medical_credit_additional  numeric not null,
  vat_rate                   numeric not null,
  mileage_rate               numeric not null,
  tax_jar_rate               numeric not null,
  note                       text,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),
  constraint tax_rates_period_check check (effective_to >= effective_from)
);

drop trigger if exists t_tax_rates_updated on tax_rates;
create trigger t_tax_rates_updated before update on tax_rates
  for each row execute function set_updated_at();

alter table tax_rates enable row level security;

-- Any signed-in user may READ the rates (the payroll/tax tools run client-side).
drop policy if exists tax_rates_select on tax_rates;
create policy tax_rates_select on tax_rates for select using (auth.uid() is not null);

-- Only platform admins may WRITE — a tenant changing national rates would break
-- tax for everyone.
drop policy if exists tax_rates_admin_write on tax_rates;
create policy tax_rates_admin_write on tax_rates for all
  using (is_platform_admin()) with check (is_platform_admin());

-- ── Seed the current tax year (2026/27), verified against SARS's published tables ──
insert into tax_rates (
  tax_year, effective_from, effective_to, paye_brackets,
  primary_rebate, secondary_rebate, tertiary_rebate, paye_monthly_threshold,
  uif_employee_rate, uif_employer_rate, uif_ceiling,
  sdl_rate, sdl_annual_threshold, company_tax_rate,
  medical_credit_first_two, medical_credit_additional,
  vat_rate, mileage_rate, tax_jar_rate, note
) values (
  '2026/27', '2026-03-01', '2027-02-28',
  '[{"from":0,"base":0,"rate":0.18},{"from":245100,"base":44118,"rate":0.26},{"from":383100,"base":79998,"rate":0.31},{"from":530200,"base":125599,"rate":0.36},{"from":695800,"base":185215,"rate":0.39},{"from":887000,"base":259783,"rate":0.41},{"from":1878600,"base":666339,"rate":0.45}]'::jsonb,
  17820, 9765, 3249, 8250,
  0.01, 0.01, 17712,
  0.01, 500000, 0.27,
  376, 254,
  0.15, 4.95, 0.28, 'Budget 2026 (SARS 2026/27 tables)'
)
on conflict (tax_year) do nothing;
