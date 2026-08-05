-- 0111: pause new registrations during final development.
-- A global flag + a BEFORE INSERT guard on auth.users so NO new account can be
-- created (email/password, magic link, OAuth or invite) while signups_enabled is
-- false — enforced at the DATABASE, not just hidden in the UI. Flip the flag to
-- true with one UPDATE to re-open at launch; no deploy needed:
--   update public.platform_settings set signups_enabled = true, updated_at = now();
create table if not exists public.platform_settings (
  id boolean primary key default true,
  signups_enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint platform_settings_singleton check (id)
);

insert into public.platform_settings (id, signups_enabled)
values (true, false)
on conflict (id) do update set signups_enabled = excluded.signups_enabled, updated_at = now();

alter table public.platform_settings enable row level security;
drop policy if exists "platform_settings_read" on public.platform_settings;
-- Public read: the signup page reads this one boolean to decide whether to show
-- the form. No write policy — only the service role / SQL can flip the flag.
create policy "platform_settings_read" on public.platform_settings for select using (true);

create or replace function public.block_signup_when_disabled()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  -- Fail open only if the config row is somehow missing, so a deleted row can
  -- never permanently brick sign-up; the seeded row makes this false today.
  if not coalesce((select signups_enabled from public.platform_settings limit 1), true) then
    raise exception 'New sign-ups are temporarily closed while Worklog is in final development.'
      using errcode = 'raise_exception';
  end if;
  return new;
end;
$$;

drop trigger if exists block_signup_when_disabled on auth.users;
create trigger block_signup_when_disabled
  before insert on auth.users
  for each row execute function public.block_signup_when_disabled();
