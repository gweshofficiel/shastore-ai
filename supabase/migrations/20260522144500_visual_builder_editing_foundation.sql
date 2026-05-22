-- Visual builder editing foundation.
-- Additive only: draft editing tables for buyer storefronts. Does not change storefront rendering,
-- publish/unpublish, products, checkout, payments, reseller, provisioning, domains, or tenant routing.

create extension if not exists "pgcrypto";

create table if not exists public.store_builder_section_drafts (
  id uuid primary key default gen_random_uuid(),
  builder_page_id uuid references public.builder_pages(id) on delete cascade,
  builder_draft_id uuid references public.builder_drafts(id) on delete cascade,
  store_instance_id uuid not null references public.store_instances(id) on delete cascade,
  owner_user_id uuid references auth.users(id) on delete cascade,
  source_section_id text,
  section_key text not null,
  section_type text not null
    check (section_type in (
      'hero',
      'banner',
      'product_grid',
      'featured_products',
      'rich_text',
      'image',
      'CTA',
      'testimonials',
      'newsletter',
      'spacer'
    )),
  section_order integer not null default 0,
  section_enabled boolean not null default true,
  settings jsonb not null default '{}'::jsonb,
  draft_schema jsonb not null default '{}'::jsonb,
  editor_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_instance_id, section_key)
);

create table if not exists public.store_builder_edit_sessions (
  id uuid primary key default gen_random_uuid(),
  builder_page_id uuid references public.builder_pages(id) on delete cascade,
  builder_draft_id uuid references public.builder_drafts(id) on delete cascade,
  store_instance_id uuid not null references public.store_instances(id) on delete cascade,
  owner_user_id uuid references auth.users(id) on delete cascade,
  session_status text not null default 'active'
    check (session_status in ('active', 'saved', 'rolled_back', 'expired')),
  selected_section_id uuid references public.store_builder_section_drafts(id) on delete set null,
  responsive_mode text not null default 'desktop'
    check (responsive_mode in ('desktop', 'tablet', 'mobile')),
  preview_state jsonb not null default '{}'::jsonb,
  editor_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  saved_at timestamptz
);

create table if not exists public.store_builder_history (
  id uuid primary key default gen_random_uuid(),
  builder_page_id uuid references public.builder_pages(id) on delete cascade,
  builder_draft_id uuid references public.builder_drafts(id) on delete set null,
  store_instance_id uuid not null references public.store_instances(id) on delete cascade,
  owner_user_id uuid references auth.users(id) on delete cascade,
  action_key text not null,
  snapshot_schema jsonb not null default '{}'::jsonb,
  snapshot_sections jsonb not null default '[]'::jsonb,
  editor_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists store_builder_section_drafts_store_order_idx
  on public.store_builder_section_drafts(store_instance_id, section_order, created_at);

create index if not exists store_builder_edit_sessions_store_idx
  on public.store_builder_edit_sessions(store_instance_id, session_status, updated_at desc);

create index if not exists store_builder_history_store_idx
  on public.store_builder_history(store_instance_id, created_at desc);

alter table public.store_builder_section_drafts enable row level security;
alter table public.store_builder_edit_sessions enable row level security;
alter table public.store_builder_history enable row level security;

do $$
declare
  managed_table text;
begin
  foreach managed_table in array array[
    'store_builder_section_drafts',
    'store_builder_edit_sessions',
    'store_builder_history'
  ]
  loop
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = managed_table
        and policyname = 'Buyer store members read builder editing records'
    ) then
      execute format(
        'create policy "Buyer store members read builder editing records" on public.%I for select using (public.can_access_store_instance(store_instance_id))',
        managed_table
      );
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = managed_table
        and policyname = 'Buyer store managers write builder editing records'
    ) then
      execute format(
        'create policy "Buyer store managers write builder editing records" on public.%I for all using (public.can_manage_store_instance(store_instance_id)) with check (public.can_manage_store_instance(store_instance_id))',
        managed_table
      );
    end if;
  end loop;
end $$;

create or replace function public.set_store_builder_editing_updated_at()
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
  if not exists (select 1 from pg_trigger where tgname = 'store_builder_section_drafts_updated_at') then
    create trigger store_builder_section_drafts_updated_at
      before update on public.store_builder_section_drafts
      for each row execute function public.set_store_builder_editing_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'store_builder_edit_sessions_updated_at') then
    create trigger store_builder_edit_sessions_updated_at
      before update on public.store_builder_edit_sessions
      for each row execute function public.set_store_builder_editing_updated_at();
  end if;
end $$;
