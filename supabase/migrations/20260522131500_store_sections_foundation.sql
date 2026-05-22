-- Store sections and page builder foundation.
-- Additive only: prepares tenant-scoped storefront sections without changing products, checkout, reseller, provisioning, domains, tenant routing, or publish logic.

create extension if not exists "pgcrypto";

create table if not exists public.store_sections (
  id uuid primary key default gen_random_uuid(),
  store_instance_id uuid not null references public.store_instances(id) on delete cascade,
  owner_user_id uuid references auth.users(id) on delete cascade,
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
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.store_sections
  add column if not exists owner_user_id uuid references auth.users(id) on delete cascade,
  add column if not exists section_type text not null default 'rich_text',
  add column if not exists section_order integer not null default 0,
  add column if not exists section_enabled boolean not null default true,
  add column if not exists config jsonb not null default '{}'::jsonb;

update public.store_sections sections
set owner_user_id = instances.owner_user_id
from public.store_instances instances
where sections.store_instance_id = instances.id
  and sections.owner_user_id is null;

create index if not exists store_sections_instance_order_idx
  on public.store_sections(store_instance_id, section_enabled, section_order, created_at);

create index if not exists store_sections_owner_idx
  on public.store_sections(owner_user_id, updated_at desc);

alter table public.store_sections enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'store_sections'
      and policyname = 'Buyer store members read store sections'
  ) then
    create policy "Buyer store members read store sections"
      on public.store_sections for select
      using (public.can_access_store_instance(store_instance_id));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'store_sections'
      and policyname = 'Buyer store managers write store sections'
  ) then
    create policy "Buyer store managers write store sections"
      on public.store_sections for all
      using (public.can_manage_store_instance(store_instance_id))
      with check (public.can_manage_store_instance(store_instance_id));
  end if;
end $$;

create or replace function public.set_store_sections_updated_at()
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
  if not exists (select 1 from pg_trigger where tgname = 'store_sections_updated_at') then
    create trigger store_sections_updated_at
      before update on public.store_sections
      for each row execute function public.set_store_sections_updated_at();
  end if;
end $$;
