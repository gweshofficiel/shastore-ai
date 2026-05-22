-- Builder version history and rollback foundation.
-- Additive only: records draft/published snapshots and publish history without changing
-- storefront rendering, tenant routing, domains, products, checkout, payments, reseller, or provisioning systems.

create extension if not exists "pgcrypto";

create table if not exists public.builder_version_snapshots (
  id uuid primary key default gen_random_uuid(),
  builder_page_id uuid references public.builder_pages(id) on delete cascade,
  builder_draft_id uuid references public.builder_drafts(id) on delete set null,
  builder_layout_version_id uuid references public.builder_layout_versions(id) on delete set null,
  store_instance_id uuid not null references public.store_instances(id) on delete cascade,
  owner_user_id uuid references auth.users(id) on delete cascade,
  snapshot_type text not null default 'draft'
    check (snapshot_type in ('draft', 'published', 'rollback', 'auto_save')),
  snapshot_label text,
  schema_version integer not null default 1,
  layout_schema jsonb not null default '{"version":1,"sections":[]}'::jsonb,
  layout_tree jsonb not null default '{"root":{"children":[]}}'::jsonb,
  responsive_config jsonb not null default '{"desktop":{},"tablet":{},"mobile":{}}'::jsonb,
  editor_state jsonb not null default '{}'::jsonb,
  layout_diff jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.builder_publish_history (
  id uuid primary key default gen_random_uuid(),
  builder_page_id uuid references public.builder_pages(id) on delete cascade,
  builder_layout_version_id uuid references public.builder_layout_versions(id) on delete set null,
  snapshot_id uuid references public.builder_version_snapshots(id) on delete set null,
  store_instance_id uuid not null references public.store_instances(id) on delete cascade,
  owner_user_id uuid references auth.users(id) on delete cascade,
  publish_status text not null default 'published'
    check (publish_status in ('published', 'restored', 'rolled_back', 'failed')),
  version_number integer,
  published_at timestamptz not null default now(),
  restored_from_version_id uuid,
  rollback_target_version_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists builder_version_snapshots_store_idx
  on public.builder_version_snapshots(store_instance_id, created_at desc);

create index if not exists builder_version_snapshots_page_type_idx
  on public.builder_version_snapshots(builder_page_id, snapshot_type, created_at desc);

create index if not exists builder_publish_history_store_idx
  on public.builder_publish_history(store_instance_id, published_at desc);

create index if not exists builder_publish_history_page_idx
  on public.builder_publish_history(builder_page_id, published_at desc);

alter table public.builder_version_snapshots enable row level security;
alter table public.builder_publish_history enable row level security;

do $$
declare
  managed_table text;
begin
  foreach managed_table in array array[
    'builder_version_snapshots',
    'builder_publish_history'
  ]
  loop
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = managed_table
        and policyname = 'Buyer store members read builder history records'
    ) then
      execute format(
        'create policy "Buyer store members read builder history records" on public.%I for select using (public.can_access_store_instance(store_instance_id))',
        managed_table
      );
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = managed_table
        and policyname = 'Buyer store managers write builder history records'
    ) then
      execute format(
        'create policy "Buyer store managers write builder history records" on public.%I for all using (public.can_manage_store_instance(store_instance_id)) with check (public.can_manage_store_instance(store_instance_id))',
        managed_table
      );
    end if;
  end loop;
end $$;
