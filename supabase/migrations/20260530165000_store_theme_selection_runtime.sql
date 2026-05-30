-- Store theme selection runtime.
-- Additive only: keeps the existing Theme Runtime resolver contract unchanged.

create extension if not exists "pgcrypto";

alter table public.store_themes
  add column if not exists store_id uuid,
  add column if not exists theme_key text not null default 'default',
  add column if not exists status text not null default 'draft',
  add column if not exists is_active boolean not null default false,
  add column if not exists published_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'store_themes_runtime_status_check'
      and conrelid = 'public.store_themes'::regclass
  ) then
    alter table public.store_themes
      drop constraint store_themes_runtime_status_check;
  end if;

  alter table public.store_themes
    add constraint store_themes_runtime_status_check
    check (status in ('draft', 'published', 'active', 'archived'));
end $$;

create unique index if not exists store_themes_one_active_selection_idx
on public.store_themes(coalesce(store_id, store_instance_id))
where is_active = true;

create unique index if not exists store_themes_store_theme_key_idx
on public.store_themes(coalesce(store_id, store_instance_id), theme_key);

create unique index if not exists store_themes_store_id_theme_key_idx
on public.store_themes(store_id, theme_key)
where store_id is not null;

create unique index if not exists store_themes_store_id_theme_key_upsert_idx
on public.store_themes(store_id, theme_key);

create unique index if not exists store_themes_instance_theme_key_idx
on public.store_themes(store_instance_id, theme_key)
where store_instance_id is not null;

create table if not exists public.theme_selection_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid,
  store_id uuid,
  theme_key text not null,
  action text not null,
  created_at timestamptz not null default now()
);

create index if not exists theme_selection_logs_store_created_idx
on public.theme_selection_logs(store_id, created_at desc);

alter table public.theme_selection_logs enable row level security;

drop policy if exists "workspace members read store themes" on public.store_themes;
create policy "workspace members read store themes"
on public.store_themes
for select
to authenticated
using (
  workspace_id is not null
  and public.can_access_workspace(workspace_id)
);

drop policy if exists "workspace editors manage store themes" on public.store_themes;
create policy "workspace editors manage store themes"
on public.store_themes
for all
to authenticated
using (
  workspace_id is not null
  and public.can_access_workspace(workspace_id)
)
with check (
  workspace_id is not null
  and public.can_access_workspace(workspace_id)
);

drop policy if exists "service role can manage store themes" on public.store_themes;
create policy "service role can manage store themes"
on public.store_themes
for all
to service_role
using (true)
with check (true);

drop policy if exists "workspace members read theme selection logs" on public.theme_selection_logs;
create policy "workspace members read theme selection logs"
on public.theme_selection_logs
for select
to authenticated
using (
  workspace_id is not null
  and public.can_access_workspace(workspace_id)
);

drop policy if exists "service role can manage theme selection logs" on public.theme_selection_logs;
create policy "service role can manage theme selection logs"
on public.theme_selection_logs
for all
to service_role
using (true)
with check (true);
