-- Full builder live preview runtime foundation.
-- Additive only: creates isolated draft preview runtime records without changing
-- published storefront rendering, hostname/domain routing, tenant isolation,
-- products, orders, checkout, payments, reseller, or provisioning systems.

create extension if not exists "pgcrypto";

create table if not exists public.builder_preview_sessions (
  id uuid primary key default gen_random_uuid(),
  store_instance_id uuid not null references public.store_instances(id) on delete cascade,
  owner_user_id uuid references auth.users(id) on delete cascade,
  builder_page_id uuid references public.builder_pages(id) on delete cascade,
  builder_draft_id uuid references public.builder_drafts(id) on delete cascade,
  session_status text not null default 'active'
    check (session_status in ('active', 'refreshing', 'synced', 'stale', 'error', 'closed')),
  preview_mode text not null default 'desktop'
    check (preview_mode in ('desktop', 'tablet', 'mobile')),
  session_key text not null default encode(gen_random_bytes(16), 'hex'),
  hydration_state jsonb not null default '{}'::jsonb,
  isolation_state jsonb not null default '{}'::jsonb,
  sync_state jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.preview_runtime_states (
  id uuid primary key default gen_random_uuid(),
  store_instance_id uuid not null references public.store_instances(id) on delete cascade,
  owner_user_id uuid references auth.users(id) on delete cascade,
  builder_page_id uuid references public.builder_pages(id) on delete cascade,
  builder_draft_id uuid references public.builder_drafts(id) on delete cascade,
  preview_session_id uuid references public.builder_preview_sessions(id) on delete cascade,
  runtime_status text not null default 'ready'
    check (runtime_status in ('ready', 'syncing', 'stale', 'fallback', 'error')),
  sync_source text not null default 'manual_refresh'
    check (sync_source in ('manual_refresh', 'draft_change', 'reorder_change', 'style_change', 'ai_draft_change', 'responsive_change', 'rollback_change')),
  runtime_schema jsonb not null default '{}'::jsonb,
  render_tree jsonb not null default '{}'::jsonb,
  responsive_state jsonb not null default '{}'::jsonb,
  hydration_state jsonb not null default '{}'::jsonb,
  isolation_state jsonb not null default '{}'::jsonb,
  error_state jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (builder_draft_id)
);

create table if not exists public.preview_render_cache (
  id uuid primary key default gen_random_uuid(),
  store_instance_id uuid not null references public.store_instances(id) on delete cascade,
  owner_user_id uuid references auth.users(id) on delete cascade,
  builder_page_id uuid references public.builder_pages(id) on delete cascade,
  builder_draft_id uuid references public.builder_drafts(id) on delete cascade,
  preview_session_id uuid references public.builder_preview_sessions(id) on delete cascade,
  cache_status text not null default 'prepared'
    check (cache_status in ('prepared', 'fresh', 'stale', 'invalidated', 'error')),
  cache_key text not null default encode(gen_random_bytes(16), 'hex'),
  render_payload jsonb not null default '{}'::jsonb,
  hydration_payload jsonb not null default '{}'::jsonb,
  responsive_payload jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists builder_preview_sessions_store_idx
  on public.builder_preview_sessions(store_instance_id, session_status, updated_at desc);

create index if not exists preview_runtime_states_store_idx
  on public.preview_runtime_states(store_instance_id, runtime_status, updated_at desc);

create index if not exists preview_render_cache_store_idx
  on public.preview_render_cache(store_instance_id, cache_status, updated_at desc);

alter table public.builder_preview_sessions enable row level security;
alter table public.preview_runtime_states enable row level security;
alter table public.preview_render_cache enable row level security;

do $$
declare
  managed_table text;
begin
  foreach managed_table in array array[
    'builder_preview_sessions',
    'preview_runtime_states',
    'preview_render_cache'
  ]
  loop
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = managed_table
        and policyname = 'Buyer store members read builder preview runtime records'
    ) then
      execute format(
        'create policy "Buyer store members read builder preview runtime records" on public.%I for select using (public.can_access_store_instance(store_instance_id))',
        managed_table
      );
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = managed_table
        and policyname = 'Buyer store managers write builder preview runtime records'
    ) then
      execute format(
        'create policy "Buyer store managers write builder preview runtime records" on public.%I for all using (public.can_manage_store_instance(store_instance_id)) with check (public.can_manage_store_instance(store_instance_id))',
        managed_table
      );
    end if;
  end loop;
end $$;
