-- Visual builder persistence foundation.
-- Additive only: prepares draft/published layout persistence without changing storefront rendering, checkout, products, reseller, provisioning, domains, or tenant routing.

create extension if not exists "pgcrypto";

create table if not exists public.builder_pages (
  id uuid primary key default gen_random_uuid(),
  store_instance_id uuid not null references public.store_instances(id) on delete cascade,
  owner_user_id uuid references auth.users(id) on delete cascade,
  page_key text not null default 'home',
  page_title text not null default 'Home',
  status text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),
  active_version_id uuid,
  schema_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_instance_id, page_key)
);

create table if not exists public.builder_layout_versions (
  id uuid primary key default gen_random_uuid(),
  builder_page_id uuid not null references public.builder_pages(id) on delete cascade,
  store_instance_id uuid not null references public.store_instances(id) on delete cascade,
  owner_user_id uuid references auth.users(id) on delete cascade,
  version_number integer not null default 1,
  layout_schema jsonb not null default '{"version":1,"sections":[]}'::jsonb,
  layout_tree jsonb not null default '{"root":{"children":[]}}'::jsonb,
  responsive_config jsonb not null default '{"desktop":{},"tablet":{},"mobile":{}}'::jsonb,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  published_at timestamptz,
  unique (builder_page_id, version_number)
);

create table if not exists public.builder_drafts (
  id uuid primary key default gen_random_uuid(),
  builder_page_id uuid not null references public.builder_pages(id) on delete cascade,
  store_instance_id uuid not null references public.store_instances(id) on delete cascade,
  owner_user_id uuid references auth.users(id) on delete cascade,
  draft_schema jsonb not null default '{"version":1,"sections":[]}'::jsonb,
  layout_tree jsonb not null default '{"root":{"children":[]}}'::jsonb,
  responsive_config jsonb not null default '{"desktop":{},"tablet":{},"mobile":{}}'::jsonb,
  editor_state jsonb not null default '{"selectedSectionId":null,"mode":"desktop","previewSyncPending":false}'::jsonb,
  has_unsaved_changes boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (builder_page_id)
);

alter table public.builder_pages
  add column if not exists owner_user_id uuid references auth.users(id) on delete cascade,
  add column if not exists page_key text not null default 'home',
  add column if not exists page_title text not null default 'Home',
  add column if not exists status text not null default 'draft',
  add column if not exists active_version_id uuid,
  add column if not exists schema_version integer not null default 1;

alter table public.builder_layout_versions
  add column if not exists owner_user_id uuid references auth.users(id) on delete cascade,
  add column if not exists version_number integer not null default 1,
  add column if not exists layout_schema jsonb not null default '{"version":1,"sections":[]}'::jsonb,
  add column if not exists layout_tree jsonb not null default '{"root":{"children":[]}}'::jsonb,
  add column if not exists responsive_config jsonb not null default '{"desktop":{},"tablet":{},"mobile":{}}'::jsonb,
  add column if not exists status text not null default 'draft',
  add column if not exists published_at timestamptz;

alter table public.builder_drafts
  add column if not exists owner_user_id uuid references auth.users(id) on delete cascade,
  add column if not exists draft_schema jsonb not null default '{"version":1,"sections":[]}'::jsonb,
  add column if not exists layout_tree jsonb not null default '{"root":{"children":[]}}'::jsonb,
  add column if not exists responsive_config jsonb not null default '{"desktop":{},"tablet":{},"mobile":{}}'::jsonb,
  add column if not exists editor_state jsonb not null default '{"selectedSectionId":null,"mode":"desktop","previewSyncPending":false}'::jsonb,
  add column if not exists has_unsaved_changes boolean not null default false;

update public.builder_pages pages
set owner_user_id = instances.owner_user_id
from public.store_instances instances
where pages.store_instance_id = instances.id
  and pages.owner_user_id is null;

update public.builder_layout_versions versions
set owner_user_id = instances.owner_user_id
from public.store_instances instances
where versions.store_instance_id = instances.id
  and versions.owner_user_id is null;

update public.builder_drafts drafts
set owner_user_id = instances.owner_user_id
from public.store_instances instances
where drafts.store_instance_id = instances.id
  and drafts.owner_user_id is null;

create index if not exists builder_pages_owner_idx
  on public.builder_pages(owner_user_id, updated_at desc);

create index if not exists builder_layout_versions_instance_status_idx
  on public.builder_layout_versions(store_instance_id, status, version_number desc);

create index if not exists builder_drafts_instance_idx
  on public.builder_drafts(store_instance_id, updated_at desc);

alter table public.builder_pages enable row level security;
alter table public.builder_layout_versions enable row level security;
alter table public.builder_drafts enable row level security;

do $$
declare
  managed_table text;
begin
  foreach managed_table in array array[
    'builder_pages',
    'builder_layout_versions',
    'builder_drafts'
  ]
  loop
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = managed_table
        and policyname = 'Buyer store members read builder persistence'
    ) then
      execute format(
        'create policy "Buyer store members read builder persistence" on public.%I for select using (public.can_access_store_instance(store_instance_id))',
        managed_table
      );
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = managed_table
        and policyname = 'Buyer store managers write builder persistence'
    ) then
      execute format(
        'create policy "Buyer store managers write builder persistence" on public.%I for all using (public.can_manage_store_instance(store_instance_id)) with check (public.can_manage_store_instance(store_instance_id))',
        managed_table
      );
    end if;
  end loop;
end $$;

create or replace function public.set_builder_pages_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.set_builder_drafts_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'builder_pages_updated_at') then
    create trigger builder_pages_updated_at
      before update on public.builder_pages
      for each row execute function public.set_builder_pages_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'builder_drafts_updated_at') then
    create trigger builder_drafts_updated_at
      before update on public.builder_drafts
      for each row execute function public.set_builder_drafts_updated_at();
  end if;
end $$;

