-- Shipping rates foundation.
-- Additive only: keeps shipping profiles, zones, methods, checkout, and orders intact.

create table if not exists public.shipping_rates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  store_id uuid not null references public.stores(id) on delete cascade,
  profile_id uuid not null references public.shipping_profiles(id) on delete cascade,
  zone_id uuid not null references public.shipping_zones(id) on delete cascade,
  rate_name text not null,
  rate_type text not null default 'flat_rate'
    check (rate_type in ('flat_rate', 'free_shipping', 'order_amount', 'weight_based')),
  price numeric(12, 2) not null default 0,
  currency text not null default 'USD',
  min_order_amount numeric(12, 2),
  max_order_amount numeric(12, 2),
  min_weight numeric(12, 3),
  max_weight numeric(12, 3),
  enabled boolean not null default true,
  status text not null default 'active' check (status in ('active', 'inactive')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.orders
  add column if not exists shipping_rate_id uuid,
  add column if not exists shipping_rate_name text,
  add column if not exists shipping_rate_type text;

alter table if exists public.store_orders
  add column if not exists shipping_rate_id uuid,
  add column if not exists shipping_rate_name text,
  add column if not exists shipping_rate_type text;

create index if not exists shipping_rates_workspace_store_idx
on public.shipping_rates(workspace_id, store_id, enabled, sort_order);

create index if not exists shipping_rates_profile_zone_idx
on public.shipping_rates(workspace_id, store_id, profile_id, zone_id, enabled, sort_order);

alter table public.shipping_rates enable row level security;

drop policy if exists "workspace members read shipping rates" on public.shipping_rates;
drop policy if exists "workspace editors write shipping rates" on public.shipping_rates;
drop policy if exists "public can read published store shipping rates" on public.shipping_rates;

create policy "workspace members read shipping rates"
on public.shipping_rates for select to authenticated
using (public.can_access_workspace(workspace_id));

create policy "workspace editors write shipping rates"
on public.shipping_rates for all to authenticated
using (public.workspace_can_edit(workspace_id))
with check (public.workspace_can_edit(workspace_id));

create policy "public can read published store shipping rates"
on public.shipping_rates for select to anon, authenticated
using (
  enabled = true
  and status = 'active'
  and exists (
    select 1 from public.stores stores
    where stores.id = shipping_rates.store_id
      and stores.status = 'published'
  )
);
