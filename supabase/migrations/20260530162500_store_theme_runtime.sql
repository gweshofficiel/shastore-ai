-- Store theme runtime stabilization.
-- Additive only: reuses store_themes/store_theme_settings and preserves storefront routing.

create extension if not exists "pgcrypto";

create table if not exists public.store_themes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid,
  store_id uuid,
  store_instance_id uuid,
  owner_user_id uuid references auth.users(id) on delete cascade,
  theme_key text not null default 'default',
  status text not null default 'published',
  settings jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.store_themes
  add column if not exists workspace_id uuid,
  add column if not exists store_id uuid,
  add column if not exists store_instance_id uuid,
  add column if not exists owner_user_id uuid references auth.users(id) on delete cascade,
  add column if not exists theme_id text not null default 'shastore-default',
  add column if not exists theme_key text not null default 'default',
  add column if not exists layout_key text not null default 'classic',
  add column if not exists is_active boolean not null default true,
  add column if not exists status text not null default 'published',
  add column if not exists settings jsonb not null default '{}'::jsonb,
  add column if not exists typography jsonb not null default '{"heading":"inter","body":"inter","scale":"comfortable"}'::jsonb,
  add column if not exists color_palette jsonb not null default '{"primary":"#0f172a","secondary":"#2563eb","accent":"#f59e0b","background":"#f8fafc","surface":"#ffffff","text":"#0f172a","muted":"#64748b"}'::jsonb,
  add column if not exists logo_config jsonb not null default '{"mode":"text","url":null,"alt":null}'::jsonb,
  add column if not exists style_config jsonb not null default '{}'::jsonb,
  add column if not exists published_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

update public.store_themes
set
  store_id = coalesce(store_id, store_instance_id),
  status = coalesce(nullif(status, ''), case when is_active then 'published' else 'draft' end),
  settings = coalesce(settings, '{}'::jsonb),
  published_at = case
    when status = 'published' and published_at is null then updated_at
    else published_at
  end;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'store_themes_runtime_status_check'
      and conrelid = 'public.store_themes'::regclass
  ) then
    alter table public.store_themes
      add constraint store_themes_runtime_status_check
      check (status in ('draft', 'published', 'archived'));
  end if;
end $$;

create index if not exists store_themes_runtime_store_idx
on public.store_themes(store_id, status, updated_at desc);

create index if not exists store_themes_runtime_instance_idx
on public.store_themes(store_instance_id, status, updated_at desc);

create unique index if not exists store_themes_one_published_runtime_idx
on public.store_themes(coalesce(store_id, store_instance_id))
where status = 'published' and is_active = true;

create table if not exists public.theme_runtime_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid,
  store_id uuid,
  theme_key text,
  event text not null,
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists theme_runtime_logs_store_created_idx
on public.theme_runtime_logs(store_id, created_at desc);

alter table public.store_themes enable row level security;
alter table public.theme_runtime_logs enable row level security;

drop policy if exists "store theme runtime logs readable by workspace" on public.theme_runtime_logs;
create policy "store theme runtime logs readable by workspace"
on public.theme_runtime_logs
for select
to authenticated
using (
  workspace_id is not null
  and public.can_access_workspace(workspace_id)
);

drop policy if exists "service role can manage theme runtime logs" on public.theme_runtime_logs;
create policy "service role can manage theme runtime logs"
on public.theme_runtime_logs
for all
to service_role
using (true)
with check (true);
