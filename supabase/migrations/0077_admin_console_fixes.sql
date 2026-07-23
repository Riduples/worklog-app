-- 0077 — harden the admin console mutations (review follow-up to 0076).
--
-- CREATE OR REPLACE keeps the grants from 0076.

-- admin_extend_trial: only a trialing or read-only account can be given trial
-- time. Without the status filter, clicking Extend on a PAYING active account
-- silently converted it to trialing (revenue misreport + eventual lockout when
-- the extended trial lapsed instead of dunning through the paid path).
create or replace function public.admin_extend_trial(p_business_id uuid, p_days integer)
returns void
language plpgsql security definer set search_path = public, pg_catalog
as $$
begin
  if not is_platform_admin() then raise exception 'Not authorized' using errcode = 'insufficient_privilege'; end if;
  if p_days is null or p_days <= 0 or p_days > 365 then raise exception 'Days must be between 1 and 365'; end if;
  update subscriptions
     set status = 'trialing',
         current_period_end = greatest(coalesce(current_period_end, now()), now()) + (p_days * interval '1 day'),
         past_due_notified_at = null,
         trial_ending_notified_at = null
   where business_id = p_business_id
     and status in ('trialing', 'read_only');
  if not found then
    raise exception 'Only a trialing or read-only account can be given trial time';
  end if;
end;
$$;

-- admin_set_plan: normalise current_period_end to the chosen status so the result
-- is coherent with dunning/expire_trials, instead of storing the raw picker date
-- for every status (which could leave past_due stuck ~forever, or an 'active'
-- comp with a today-dated end that the next run_dunning immediately reverts).
create or replace function public.admin_set_plan(p_business_id uuid, p_tier text, p_status text, p_period_end date)
returns void
language plpgsql security definer set search_path = public, pg_catalog
as $$
declare
  v_end timestamptz;
begin
  if not is_platform_admin() then raise exception 'Not authorized' using errcode = 'insufficient_privilege'; end if;
  if p_tier not in ('solo', 'trade', 'structured') then raise exception 'Invalid tier'; end if;
  if p_status not in ('active', 'trialing', 'read_only', 'past_due', 'cancelled') then raise exception 'Invalid status'; end if;

  if p_status in ('active', 'trialing') then
    -- A live plan needs a future end, or it's already lapsed the moment it's set.
    if p_period_end is null or p_period_end <= current_date then
      raise exception 'For an active or trialing plan the period-end date must be in the future';
    end if;
    v_end := p_period_end::timestamptz;
  elsif p_status = 'past_due' then
    -- Grace is measured from now, so read_only follows after the normal window.
    v_end := now();
  else
    -- read_only / cancelled: the date is immaterial.
    v_end := coalesce(p_period_end::timestamptz, now());
  end if;

  insert into subscriptions (business_id, tier, status, current_period_end)
    values (p_business_id, p_tier, p_status, v_end)
    on conflict (business_id) do update
      set tier = excluded.tier,
          status = excluded.status,
          current_period_end = excluded.current_period_end,
          past_due_notified_at = null,
          trial_ending_notified_at = null;
end;
$$;

-- admin_list_businesses: COALESCE the nullable source columns so the (non-null)
-- return type is honest and a legacy/out-of-band row with a NULL name can't crash
-- the admin list when it's searched.
create or replace function public.admin_list_businesses()
returns table (
  business_id uuid, name text, plan text, business_type text, created_at timestamptz,
  owner_email text, member_count integer, sub_status text, sub_tier text, current_period_end timestamptz
)
language plpgsql security definer set search_path = public, pg_catalog
as $$
begin
  if not is_platform_admin() then raise exception 'Not authorized' using errcode = 'insufficient_privilege'; end if;
  return query
    select bp.id, coalesce(bp.name, '(unnamed)'), bp.plan, bp.business_type, coalesce(bp.created_at, now()),
      (select u.email::text from business_members bm join auth.users u on u.id = bm.user_id
         where bm.business_id = bp.id and bm.role = 'owner' order by bm.created_at limit 1),
      (select count(*)::integer from business_members bm2 where bm2.business_id = bp.id),
      s.status, s.tier, s.current_period_end
    from business_profiles bp
    left join subscriptions s on s.business_id = bp.id
    order by bp.created_at desc;
end;
$$;
