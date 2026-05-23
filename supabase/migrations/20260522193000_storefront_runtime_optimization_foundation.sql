-- Storefront runtime optimization and production performance foundation.
-- Additive only: prepares cache, render state, and performance telemetry records
-- without changing products, orders, checkout, reseller, provisioning, hostname/domain
-- systems, tenant isolation core, publish/launch systems, or public storefront rendering.

create extension if not exists "pgcrypto";

create table if not exists public.storefront_runtime_cache (
  id uuid primary key default gen_random_uuid(),
  store_instance_id uuid not null references public.store_instances(id) on delete cascade,
  owner_user_id uuid references auth.users(id) on delete cascade,
  builder_page_id uuid references public.builder_pages(id) on delete set null,
  builder_layout_version_id uuid references public.builder_layout_versions(id) on delete set null,
  cache_key text not null default md5(random()::text || clock_timestamp()::text),
  cache_status text not null default 'prepared'
    check (cache_status in ('prepared', 'fresh', 'stale', 'invalidated', 'error')),
  cache_scope text not null default 'published_storefront'
    check (cache_scope in ('published_storefront', 'hostname_storefront', 'localhost_storefront')),
  render_payload jsonb not null default '{}'::jsonb,
  hydration_payload jsonb not null default '{}'::jsonb,
  memoization_state jsonb not null default '{}'::jsonb,
  invalidation_state jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.preview_runtime_cache (
  id uuid primary key default gen_random_uuid(),
  store_instance_id uuid not null references public.store_instances(id) on delete cascade,
  owner_user_id uuid references auth.users(id) on delete cascade,
  builder_page_id uuid references public.builder_pages(id) on delete set null,
  builder_draft_id uuid references public.builder_drafts(id) on delete cascade,
  preview_session_id uuid references public.builder_preview_sessions(id) on delete set null,
  preview_runtime_state_id uuid references public.preview_runtime_states(id) on delete set null,
  cache_key text not null default md5(random()::text || clock_timestamp()::text),
  cache_status text not null default 'prepared'
    check (cache_status in ('prepared', 'fresh', 'stale', 'invalidated', 'error')),
  preview_mode text not null default 'desktop'
    check (preview_mode in ('desktop', 'tablet', 'mobile')),
  render_payload jsonb not null default '{}'::jsonb,
  responsive_payload jsonb not null default '{}'::jsonb,
  hydration_payload jsonb not null default '{}'::jsonb,
  isolation_payload jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.runtime_performance_logs (
  id uuid primary key default gen_random_uuid(),
  store_instance_id uuid not null references public.store_instances(id) on delete cascade,
  owner_user_id uuid references auth.users(id) on delete cascade,
  runtime_scope text not null default 'storefront'
    check (runtime_scope in ('storefront', 'builder_preview', 'tenant_runtime', 'hydration', 'responsive')),
  event_type text not null default 'snapshot'
    check (event_type in ('snapshot', 'cache_hit', 'cache_miss', 'cache_invalidated', 'preview_optimized', 'tenant_state_resolved', 'hydration_checked')),
  event_status text not null default 'recorded'
    check (event_status in ('recorded', 'healthy', 'warning', 'error')),
  duration_ms integer not null default 0 check (duration_ms >= 0),
  render_count integer not null default 0 check (render_count >= 0),
  cache_hit boolean not null default false,
  performance_payload jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.tenant_render_states (
  id uuid primary key default gen_random_uuid(),
  store_instance_id uuid not null references public.store_instances(id) on delete cascade,
  owner_user_id uuid references auth.users(id) on delete cascade,
  tenant_key text not null default '',
  runtime_status text not null default 'ready'
    check (runtime_status in ('ready', 'optimized', 'stale', 'fallback', 'error')),
  isolation_state jsonb not null default '{}'::jsonb,
  hydration_state jsonb not null default '{}'::jsonb,
  responsive_state jsonb not null default '{}'::jsonb,
  memoization_state jsonb not null default '{}'::jsonb,
  cache_state jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_instance_id)
);

create index if not exists storefront_runtime_cache_store_idx
  on public.storefront_runtime_cache(store_instance_id, cache_status, updated_at desc);

create index if not exists preview_runtime_cache_store_idx
  on public.preview_runtime_cache(store_instance_id, preview_mode, cache_status, updated_at desc);

create index if not exists runtime_performance_logs_store_idx
  on public.runtime_performance_logs(store_instance_id, runtime_scope, created_at desc);

create index if not exists tenant_render_states_store_idx
  on public.tenant_render_states(store_instance_id, runtime_status, updated_at desc);

alter table public.storefront_runtime_cache enable row level security;
alter table public.preview_runtime_cache enable row level security;
alter table public.runtime_performance_logs enable row level security;
alter table public.tenant_render_states enable row level security;

do $$
declare
  managed_table text;
begin
  foreach managed_table in array array[
    'storefront_runtime_cache',
    'preview_runtime_cache',
    'runtime_performance_logs',
    'tenant_render_states'
  ]
  loop
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = managed_table
        and policyname = 'Buyer store members read runtime optimization records'
    ) then
      execute format(
        'create policy "Buyer store members read runtime optimization records" on public.%I for select using (public.can_access_store_instance(store_instance_id))',
        managed_table
      );
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = managed_table
        and policyname = 'Buyer store managers write runtime optimization records'
    ) then
      execute format(
        'create policy "Buyer store managers write runtime optimization records" on public.%I for all using (public.can_manage_store_instance(store_instance_id)) with check (public.can_manage_store_instance(store_instance_id))',
        managed_table
      );
    end if;
  end loop;
end $$;

