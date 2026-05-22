-- Store launch and production publish experience foundation.
-- Additive only: records launch readiness, validation, and audit events for
-- buyer-owned storefronts without changing products, orders, checkout, reseller,
-- provisioning, hostname/domain systems, tenant isolation core, or public storefront rendering.

create extension if not exists "pgcrypto";

create table if not exists public.store_launch_checklists (
  id uuid primary key default gen_random_uuid(),
  store_instance_id uuid not null references public.store_instances(id) on delete cascade,
  owner_user_id uuid references auth.users(id) on delete cascade,
  builder_page_id uuid references public.builder_pages(id) on delete set null,
  builder_draft_id uuid references public.builder_drafts(id) on delete set null,
  active_version_id uuid references public.builder_layout_versions(id) on delete set null,
  checklist_status text not null default 'draft'
    check (checklist_status in ('draft', 'ready', 'blocked', 'launched', 'rolled_back', 'archived')),
  checklist_items jsonb not null default '[]'::jsonb,
  readiness_score integer not null default 0 check (readiness_score >= 0 and readiness_score <= 100),
  blocking_reasons jsonb not null default '[]'::jsonb,
  launch_metadata jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.store_launch_events (
  id uuid primary key default gen_random_uuid(),
  store_instance_id uuid not null references public.store_instances(id) on delete cascade,
  owner_user_id uuid references auth.users(id) on delete cascade,
  checklist_id uuid references public.store_launch_checklists(id) on delete set null,
  builder_page_id uuid references public.builder_pages(id) on delete set null,
  builder_layout_version_id uuid references public.builder_layout_versions(id) on delete set null,
  event_type text not null default 'readiness_checked'
    check (event_type in ('readiness_checked', 'validation_failed', 'validation_passed', 'draft_published', 'store_launched', 'rollback_requested', 'rollback_completed', 'launch_failed')),
  event_status text not null default 'recorded'
    check (event_status in ('recorded', 'succeeded', 'failed', 'blocked')),
  event_payload jsonb not null default '{}'::jsonb,
  rollback_payload jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.store_publish_validations (
  id uuid primary key default gen_random_uuid(),
  store_instance_id uuid not null references public.store_instances(id) on delete cascade,
  owner_user_id uuid references auth.users(id) on delete cascade,
  checklist_id uuid references public.store_launch_checklists(id) on delete set null,
  builder_page_id uuid references public.builder_pages(id) on delete set null,
  builder_draft_id uuid references public.builder_drafts(id) on delete set null,
  validation_status text not null default 'pending'
    check (validation_status in ('pending', 'passed', 'warning', 'blocked', 'failed')),
  validation_scope text not null default 'store_launch',
  validation_results jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  blocking_errors jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists store_launch_checklists_store_idx
  on public.store_launch_checklists(store_instance_id, checklist_status, updated_at desc);

create index if not exists store_launch_events_store_idx
  on public.store_launch_events(store_instance_id, event_type, created_at desc);

create index if not exists store_publish_validations_store_idx
  on public.store_publish_validations(store_instance_id, validation_status, created_at desc);

alter table public.store_launch_checklists enable row level security;
alter table public.store_launch_events enable row level security;
alter table public.store_publish_validations enable row level security;

do $$
declare
  managed_table text;
begin
  foreach managed_table in array array[
    'store_launch_checklists',
    'store_launch_events',
    'store_publish_validations'
  ]
  loop
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = managed_table
        and policyname = 'Buyer store members read launch records'
    ) then
      execute format(
        'create policy "Buyer store members read launch records" on public.%I for select using (public.can_access_store_instance(store_instance_id))',
        managed_table
      );
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = managed_table
        and policyname = 'Buyer store managers write launch records'
    ) then
      execute format(
        'create policy "Buyer store managers write launch records" on public.%I for all using (public.can_manage_store_instance(store_instance_id)) with check (public.can_manage_store_instance(store_instance_id))',
        managed_table
      );
    end if;
  end loop;
end $$;
