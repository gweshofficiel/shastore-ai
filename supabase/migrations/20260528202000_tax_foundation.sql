-- Tax foundation for SHASTORE AI.
-- Non-destructive: adds store/workspace scoped tax settings, tax rules, and order tax fields.

create table if not exists public.store_tax_settings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  store_id uuid not null references public.stores(id) on delete cascade,
  tax_enabled boolean not null default false,
  tax_name text not null default 'Tax',
  default_tax_rate numeric(7, 4) not null default 0 check (default_tax_rate >= 0),
  prices_include_tax boolean not null default false,
  apply_tax_to_shipping boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id)
);

create table if not exists public.store_tax_rules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  store_id uuid not null references public.stores(id) on delete cascade,
  country text not null,
  region text,
  city text,
  tax_rate numeric(7, 4) not null default 0 check (tax_rate >= 0),
  status text not null default 'active' check (status in ('active', 'inactive')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.orders
  add column if not exists tax_name text,
  add column if not exists tax_rate numeric(7, 4),
  add column if not exists tax_amount numeric(12, 2) not null default 0,
  add column if not exists prices_include_tax boolean not null default false,
  add column if not exists tax_applies_to_shipping boolean not null default false;

alter table if exists public.store_orders
  add column if not exists tax_name text,
  add column if not exists tax_rate numeric(7, 4),
  add column if not exists tax_amount numeric(12, 2) not null default 0,
  add column if not exists prices_include_tax boolean not null default false,
  add column if not exists tax_applies_to_shipping boolean not null default false;

create index if not exists store_tax_settings_workspace_store_idx
  on public.store_tax_settings(workspace_id, store_id, tax_enabled);

create index if not exists store_tax_rules_workspace_store_idx
  on public.store_tax_rules(workspace_id, store_id, status, country, region, city, sort_order);

alter table public.store_tax_settings enable row level security;
alter table public.store_tax_rules enable row level security;

drop policy if exists "workspace members read tax settings" on public.store_tax_settings;
drop policy if exists "workspace editors write tax settings" on public.store_tax_settings;
drop policy if exists "public can read published store tax settings" on public.store_tax_settings;
drop policy if exists "workspace members read tax rules" on public.store_tax_rules;
drop policy if exists "workspace editors write tax rules" on public.store_tax_rules;
drop policy if exists "public can read published store tax rules" on public.store_tax_rules;

create policy "workspace members read tax settings"
on public.store_tax_settings for select to authenticated
using (public.can_access_workspace(workspace_id));

create policy "workspace editors write tax settings"
on public.store_tax_settings for all to authenticated
using (public.workspace_can_edit(workspace_id))
with check (public.workspace_can_edit(workspace_id));

create policy "public can read published store tax settings"
on public.store_tax_settings for select to anon, authenticated
using (
  tax_enabled = true
  and exists (
    select 1 from public.stores stores
    where stores.id = store_tax_settings.store_id
      and stores.status = 'published'
  )
);

create policy "workspace members read tax rules"
on public.store_tax_rules for select to authenticated
using (public.can_access_workspace(workspace_id));

create policy "workspace editors write tax rules"
on public.store_tax_rules for all to authenticated
using (public.workspace_can_edit(workspace_id))
with check (public.workspace_can_edit(workspace_id));

create policy "public can read published store tax rules"
on public.store_tax_rules for select to anon, authenticated
using (
  status = 'active'
  and exists (
    select 1 from public.stores stores
    where stores.id = store_tax_rules.store_id
      and stores.status = 'published'
  )
);
