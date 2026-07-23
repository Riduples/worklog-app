-- 0080 — harden admin management (review follow-up to 0079). CREATE OR REPLACE
-- keeps the grants.

-- admin_remove_admin: the count-then-delete last-admin guard is write-skew prone —
-- two concurrent removals of DIFFERENT rows both see count=2, both delete, and the
-- table ends empty (locking everyone out of the console). Take an exclusive table
-- lock so the second removal blocks, then counts 1, and is correctly refused.
create or replace function public.admin_remove_admin(p_user_id uuid)
returns void
language plpgsql security definer set search_path = public, pg_catalog
as $$
begin
  if not is_platform_admin() then raise exception 'Not authorized' using errcode = 'insufficient_privilege'; end if;
  lock table platform_admins in exclusive mode;
  if (select count(*) from platform_admins) <= 1 then
    raise exception 'Cannot remove the last admin';
  end if;
  delete from platform_admins where user_id = p_user_id;
end;
$$;

-- admin_add_admin: auth.users can hold more than one row per email (unconfirmed +
-- confirmed), so a bare `limit 1` grants admin to an arbitrary — possibly
-- unconfirmed / non-functional — row. Prefer a confirmed account, then the oldest,
-- so the grant is deterministic and lands on the real account.
create or replace function public.admin_add_admin(p_email text)
returns void
language plpgsql security definer set search_path = public, pg_catalog
as $$
declare
  v_uid uuid;
begin
  if not is_platform_admin() then raise exception 'Not authorized' using errcode = 'insufficient_privilege'; end if;
  select id into v_uid
    from auth.users
   where lower(email) = lower(trim(p_email))
   order by (email_confirmed_at is not null) desc, created_at asc
   limit 1;
  if v_uid is null then
    raise exception 'No user with that email — they need to sign up first';
  end if;
  insert into platform_admins (user_id, note)
    values (v_uid, 'Added via admin console')
    on conflict (user_id) do nothing;
end;
$$;
