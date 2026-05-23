-- Visual styling and theme customization engine foundation.
-- Additive only: stores draft styling overrides for builder preview without changing
-- storefront rendering, tenant routing, domains, products, checkout, payments, reseller, or provisioning systems.

create extension if not exists "pgcrypto";

create table if not exists public.store_theme_style_overrides (
  id uuid primary key default gen_random_uuid(),
  store_instance_id uuid not null references public.store_instances(id) on delete cascade,
  owner_user_id uuid references auth.users(id) on delete cascade,
  store_theme_id uuid references public.store_themes(id) on delete set null,
  builder_page_id uuid references public.builder_pages(id) on delete cascade,
  builder_draft_id uuid references public.builder_drafts(id) on delete cascade,
  override_scope text not null default 'draft'
    check (override_scope in ('draft', 'section', 'global', 'preset')),
  section_id text,
  color_tokens jsonb not null default '{}'::jsonb,
  typography_tokens jsonb not null default '{}'::jsonb,
  spacing_tokens jsonb not null default '{}'::jsonb,
  radius_tokens jsonb not null default '{}'::jsonb,
  button_tokens jsonb not null default '{}'::jsonb,
  section_style_overrides jsonb not null default '{}'::jsonb,
  global_theme_tokens jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.builder_visual_style_states (
  id uuid primary key default gen_random_uuid(),
  store_instance_id uuid not null references public.store_instances(id) on delete cascade,
  owner_user_id uuid references auth.users(id) on delete cascade,
  store_theme_id uuid references public.store_themes(id) on delete set null,
  builder_page_id uuid references public.builder_pages(id) on delete cascade,
  builder_draft_id uuid references public.builder_drafts(id) on delete cascade,
  active_style_override_id uuid references public.store_theme_style_overrides(id) on delete set null,
  preview_tokens jsonb not null default '{}'::jsonb,
  preview_state jsonb not null default '{}'::jsonb,
  sidebar_state jsonb not null default '{}'::jsonb,
  selected_style_target text not null default 'global',
  hydration_state jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (builder_draft_id)
);

create index if not exists store_theme_style_overrides_store_idx
  on public.store_theme_style_overrides(store_instance_id, override_scope, updated_at desc);

create index if not exists store_theme_style_overrides_section_idx
  on public.store_theme_style_overrides(store_instance_id, section_id, updated_at desc);

create index if not exists builder_visual_style_states_store_idx
  on public.builder_visual_style_states(store_instance_id, updated_at desc);

alter table public.store_theme_style_overrides enable row level security;
alter table public.builder_visual_style_states enable row level security;

do $$
declare
  managed_table text;
begin
  foreach managed_table in array array[
    'store_theme_style_overrides',
    'builder_visual_style_states'
  ]
  loop
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = managed_table
        and policyname = 'Buyer store members read visual style records'
    ) then
      execute format(
        'create policy "Buyer store members read visual style records" on public.%I for select using (public.can_access_store_instance(store_instance_id))',
        managed_table
      );
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = managed_table
        and policyname = 'Buyer store managers write visual style records'
    ) then
      execute format(
        'create policy "Buyer store managers write visual style records" on public.%I for all using (public.can_manage_store_instance(store_instance_id)) with check (public.can_manage_store_instance(store_instance_id))',
        managed_table
      );
    end if;
  end loop;
end $$;

