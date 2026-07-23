-- 0076 — platform-admin console data layer.
--
-- Admins need to read across ALL tenants and act on any subscription, which RLS
-- deliberately forbids. Same pattern as get_business_members / update_business_plan:
-- SECURITY DEFINER functions that FIRST check is_platform_admin() and raise if not,
-- granted to authenticated (the check inside is the gate, not the grant). Never
-- expose the underlying tables cross-tenant.

-- ── Read: every business + owner + subscription, newest first ────────────────
create or replace function public.admin_list_businesses()
returns table (
  business_id uuid,
  name text,
  plan text,
  business_type text,
  created_at timestamptz,
  owner_email text,
  member_count integer,
  sub_status text,
  sub_tier text,
  current_period_end timestamptz
)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if not is_platform_admin() then
    raise exception 'Not authorized' using errcode = 'insufficient_privilege';
  end if;
  return query
    select
      bp.id,
      bp.name,
      bp.plan,
      bp.business_type,
      bp.created_at,
      (select u.email::text
         from business_members bm
         join auth.users u on u.id = bm.user_id
        where bm.business_id = bp.id and bm.role = 'owner'
        order by bm.created_at
        limit 1),
      (select count(*)::integer from business_members bm2 where bm2.business_id = bp.id),
      s.status,
      s.tier,
      s.current_period_end
    from business_profiles bp
    left join subscriptions s on s.business_id = bp.id
    order by bp.created_at desc;
end;
$$;

-- ── Read: the PayFast ITN audit trail (optionally for one business) ───────────
create or replace function public.admin_list_payment_events(p_business_id uuid default null, p_limit integer default 100)
returns table (
  id uuid,
  business_id uuid,
  business_name text,
  event_type text,
  signature_valid boolean,
  source_ip text,
  processed_at timestamptz,
  raw_payload jsonb
)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if not is_platform_admin() then
    raise exception 'Not authorized' using errcode = 'insufficient_privilege';
  end if;
  return query
    select pe.id, pe.business_id, bp.name, pe.event_type, pe.signature_valid, pe.source_ip, pe.processed_at, pe.raw_payload
    from payment_events pe
    left join business_profiles bp on bp.id = pe.business_id
    where p_business_id is null or pe.business_id = p_business_id
    order by pe.processed_at desc
    limit greatest(1, least(coalesce(p_limit, 100), 500));
end;
$$;

-- ── Write: extend a trial by N days (support tool) ───────────────────────────
create or replace function public.admin_extend_trial(p_business_id uuid, p_days integer)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if not is_platform_admin() then
    raise exception 'Not authorized' using errcode = 'insufficient_privilege';
  end if;
  if p_days is null or p_days <= 0 or p_days > 365 then
    raise exception 'Days must be between 1 and 365';
  end if;
  update subscriptions
     set status = 'trialing',
         current_period_end = greatest(coalesce(current_period_end, now()), now()) + (p_days * interval '1 day'),
         past_due_notified_at = null,
         trial_ending_notified_at = null
   where business_id = p_business_id;
  if not found then
    raise exception 'That business has no subscription to extend';
  end if;
end;
$$;

-- ── Write: set a subscription's tier/status/period end (comp plan, status flip) ─
create or replace function public.admin_set_plan(p_business_id uuid, p_tier text, p_status text, p_period_end date)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if not is_platform_admin() then
    raise exception 'Not authorized' using errcode = 'insufficient_privilege';
  end if;
  if p_tier not in ('solo', 'trade', 'structured') then
    raise exception 'Invalid tier';
  end if;
  if p_status not in ('active', 'trialing', 'read_only', 'past_due', 'cancelled') then
    raise exception 'Invalid status';
  end if;
  insert into subscriptions (business_id, tier, status, current_period_end)
    values (p_business_id, p_tier, p_status, p_period_end)
    on conflict (business_id) do update
      set tier = excluded.tier,
          status = excluded.status,
          current_period_end = excluded.current_period_end,
          past_due_notified_at = null,
          trial_ending_notified_at = null;
end;
$$;

-- ── Grants: reachable by any signed-in user; the is_platform_admin() check inside
--    each function is the real gate. Never anon. ──────────────────────────────
revoke execute on function public.admin_list_businesses() from public, anon;
revoke execute on function public.admin_list_payment_events(uuid, integer) from public, anon;
revoke execute on function public.admin_extend_trial(uuid, integer) from public, anon;
revoke execute on function public.admin_set_plan(uuid, text, text, date) from public, anon;
grant execute on function public.admin_list_businesses() to authenticated;
grant execute on function public.admin_list_payment_events(uuid, integer) to authenticated;
grant execute on function public.admin_extend_trial(uuid, integer) to authenticated;
grant execute on function public.admin_set_plan(uuid, text, text, date) to authenticated;
