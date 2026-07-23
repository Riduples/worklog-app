-- 0078 — platform-wide announcement banner.
--
-- A platform admin posts a message (maintenance, a new feature, a deadline) that
-- shows as a banner to every user. Not per-tenant — it's Worklog talking to all of
-- its users, so writes are platform-admin only; reads are restricted by RLS to the
-- announcements that are actually LIVE right now, so a draft/expired one never
-- leaks to a normal user.

create table if not exists announcements (
  id          uuid primary key default gen_random_uuid(),
  message     text not null,
  level       text not null default 'info' check (level in ('info', 'warning', 'success')),
  link_url    text,
  link_label  text,
  active      boolean not null default true,
  starts_at   timestamptz,
  ends_at     timestamptz,
  dismissible boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists t_announcements_updated on announcements;
create trigger t_announcements_updated before update on announcements
  for each row execute function set_updated_at();

alter table announcements enable row level security;

-- Any signed-in user sees only the announcements that are live now (active + in
-- their time window). A draft/scheduled/expired one is invisible to them.
drop policy if exists announcements_select_live on announcements;
create policy announcements_select_live on announcements for select
  using (
    auth.uid() is not null
    and active
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at >= now())
  );

-- Platform admins see and manage everything (drafts, schedule, history).
drop policy if exists announcements_admin_all on announcements;
create policy announcements_admin_all on announcements for all
  using (is_platform_admin()) with check (is_platform_admin());
