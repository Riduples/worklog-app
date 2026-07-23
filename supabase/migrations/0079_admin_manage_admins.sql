-- 0079 — manage the platform-admins list from the console.
--
-- Same gated-SECURITY-DEFINER pattern (migration 0076). Adding/removing admins is
-- itself an admin-only action; a guard prevents removing the LAST admin, which
-- would lock everyone out of the console with no in-app way back.

create or replace function public.admin_list_admins()
returns table (user_id uuid, email text, note text, created_at timestamptz)
language plpgsql security definer set search_path = public, pg_catalog
as $$
begin
  if not is_platform_admin() then raise exception 'Not authorized' using errcode = 'insufficient_privilege'; end if;
  return query
    select pa.user_id, u.email::text, pa.note, pa.created_at
    from platform_admins pa
    join auth.users u on u.id = pa.user_id
    order by pa.created_at;
end;
$$;

-- Add by email — the person must already have a Worklog account.
create or replace function public.admin_add_admin(p_email text)
returns void
language plpgsql security definer set search_path = public, pg_catalog
as $$
declare
  v_uid uuid;
begin
  if not is_platform_admin() then raise exception 'Not authorized' using errcode = 'insufficient_privilege'; end if;
  select id into v_uid from auth.users where lower(email) = lower(trim(p_email)) limit 1;
  if v_uid is null then
    raise exception 'No user with that email — they need to sign up first';
  end if;
  insert into platform_admins (user_id, note)
    values (v_uid, 'Added via admin console')
    on conflict (user_id) do nothing;
end;
$$;

create or replace function public.admin_remove_admin(p_user_id uuid)
returns void
language plpgsql security definer set search_path = public, pg_catalog
as $$
begin
  if not is_platform_admin() then raise exception 'Not authorized' using errcode = 'insufficient_privilege'; end if;
  if (select count(*) from platform_admins) <= 1 then
    raise exception 'Cannot remove the last admin';
  end if;
  delete from platform_admins where user_id = p_user_id;
end;
$$;

revoke execute on function public.admin_list_admins() from public, anon;
revoke execute on function public.admin_add_admin(text) from public, anon;
revoke execute on function public.admin_remove_admin(uuid) from public, anon;
grant execute on function public.admin_list_admins() to authenticated;
grant execute on function public.admin_add_admin(text) to authenticated;
grant execute on function public.admin_remove_admin(uuid) to authenticated;
