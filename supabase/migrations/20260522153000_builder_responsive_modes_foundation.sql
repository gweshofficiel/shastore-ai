-- Responsive builder modes and device preview foundation.
-- Additive only: prepares breakpoint-scoped builder preview state without changing
-- storefront rendering, tenant routing, domains, products, checkout, payments, reseller, or provisioning systems.

create extension if not exists "pgcrypto";

create table if not exists public.builder_responsive_configs (
  id uuid primary key default gen_random_uuid(),
  builder_page_id uuid references public.builder_pages(id) on delete cascade,
  builder_draft_id uuid references public.builder_drafts(id) on delete cascade,
  store_instance_id uuid not null references public.store_instances(id) on delete cascade,
  owner_user_id uuid references auth.users(id) on delete cascade,
  breakpoint_key text not null
    check (breakpoint_key in ('desktop', 'tablet', 'mobile')),
  config jsonb not null default '{}'::jsonb,
  section_overrides jsonb not null default '{}'::jsonb,
  layout_overrides jsonb not null default '{}'::jsonb,
  typography_overrides jsonb not null default '{}'::jsonb,
  spacing_overrides jsonb not null default '{}'::jsonb,
  visibility_overrides jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (builder_draft_id, breakpoint_key)
);

create table if not exists public.responsive_layout_states (
  id uuid primary key default gen_random_uuid(),
  builder_page_id uuid references public.builder_pages(id) on delete cascade,
  builder_draft_id uuid references public.builder_drafts(id) on delete cascade,
  store_instance_id uuid not null references public.store_instances(id) on delete cascade,
  owner_user_id uuid references auth.users(id) on delete cascade,
  active_breakpoint text not null default 'desktop'
    check (active_breakpoint in ('desktop', 'tablet', 'mobile')),
  preview_state jsonb not null default '{}'::jsonb,
  device_frame jsonb not null default '{}'::jsonb,
  hydration_state jsonb not null default '{}'::jsonb,
  layout_state jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (builder_draft_id)
);

create index if not exists builder_responsive_configs_store_idx
  on public.builder_responsive_configs(store_instance_id, breakpoint_key, updated_at desc);

create index if not exists responsive_layout_states_store_idx
  on public.responsive_layout_states(store_instance_id, active_breakpoint, updated_at desc);

alter table public.builder_responsive_configs enable row level security;
alter table public.responsive_layout_states enable row level security;

do $$
declare
  managed_table text;
begin
  foreach managed_table in array array[
    'builder_responsive_configs',
    'responsive_layout_states'
  ]
  loop
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = managed_table
        and policyname = 'Buyer store members read responsive builder records'
    ) then
      execute format(
        'create policy "Buyer store members read responsive builder records" on public.%I for select using (public.can_access_store_instance(store_instance_id))',
        managed_table
      );
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = managed_table
        and policyname = 'Buyer store managers write responsive builder records'
    ) then
      execute format(
        'create policy "Buyer store managers write responsive builder records" on public.%I for all using (public.can_manage_store_instance(store_instance_id)) with check (public.can_manage_store_instance(store_instance_id))',
        managed_table
      );
    end if;
  end loop;
end $$;
