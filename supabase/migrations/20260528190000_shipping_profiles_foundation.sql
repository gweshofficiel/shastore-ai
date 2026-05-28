-- Shipping profiles foundation for SHASTORE AI.
-- Non-destructive: adds store/workspace scoped profiles, zones, and method fields.

create table if not exists public.shipping_profiles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  is_default boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shipping_zones (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  store_id uuid not null references public.stores(id) on delete cascade,
  profile_id uuid not null references public.shipping_profiles(id) on delete cascade,
  country text not null,
  region text,
  city text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shipping_methods (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid,
  store_id uuid references public.stores(id) on delete cascade,
  profile_id uuid references public.shipping_profiles(id) on delete cascade,
  zone_id uuid references public.shipping_zones(id) on delete set null,
  name text,
  method_type text,
  status text,
  fixed_fee numeric(12, 2),
  free_shipping_threshold numeric(12, 2),
  min_weight numeric(12, 3),
  max_weight numeric(12, 3),
  processing_time_days integer,
  estimated_min_days integer,
  estimated_max_days integer,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.shipping_methods
  add column if not exists user_id uuid,
  add column if not exists dashboard_scope text,
  add column if not exists method_name text,
  add column if not exists enabled boolean,
  add column if not exists flat_fee numeric(12, 2),
  add column if not exists pickup_enabled boolean,
  add column if not exists preparation_delay_days integer,
  add column if not exists estimated_delivery_days integer,
  add column if not exists workspace_id uuid,
  add column if not exists store_id uuid references public.stores(id) on delete cascade,
  add column if not exists profile_id uuid references public.shipping_profiles(id) on delete cascade,
  add column if not exists zone_id uuid references public.shipping_zones(id) on delete set null,
  add column if not exists name text,
  add column if not exists method_type text,
  add column if not exists status text,
  add column if not exists fixed_fee numeric(12, 2),
  add column if not exists free_shipping_threshold numeric(12, 2),
  add column if not exists min_weight numeric(12, 3),
  add column if not exists max_weight numeric(12, 3),
  add column if not exists processing_time_days integer,
  add column if not exists estimated_min_days integer,
  add column if not exists estimated_max_days integer;

alter table if exists public.orders
  add column if not exists shipping_method_id uuid,
  add column if not exists shipping_method_name text,
  add column if not exists shipping_method_type text;

alter table if exists public.store_orders
  add column if not exists shipping_method_id uuid,
  add column if not exists shipping_method_name text,
  add column if not exists shipping_method_type text;

do $$
begin
  if to_regclass('public.shipping_methods') is not null then
    update public.shipping_methods
    set
      name = coalesce(name, method_name, 'Shipping method'),
      method_type = coalesce(method_type, case when pickup_enabled is true then 'local_pickup' else 'standard' end),
      status = coalesce(status, case when enabled is false then 'inactive' else 'active' end),
      fixed_fee = coalesce(fixed_fee, flat_fee, 0),
      free_shipping_threshold = coalesce(free_shipping_threshold, null),
      processing_time_days = coalesce(processing_time_days, preparation_delay_days, 0),
      estimated_min_days = coalesce(estimated_min_days, estimated_delivery_days, 3),
      estimated_max_days = coalesce(estimated_max_days, estimated_delivery_days, 3)
    where name is null
       or method_type is null
       or status is null
       or fixed_fee is null
       or processing_time_days is null
       or estimated_min_days is null
       or estimated_max_days is null;

    if not exists (
      select 1 from pg_constraint
      where conname = 'shipping_methods_method_type_check'
        and conrelid = 'public.shipping_methods'::regclass
    ) then
      alter table public.shipping_methods
        add constraint shipping_methods_method_type_check
        check (method_type is null or method_type in ('standard', 'express', 'local_delivery', 'local_pickup'));
    end if;

    if not exists (
      select 1 from pg_constraint
      where conname = 'shipping_methods_status_check'
        and conrelid = 'public.shipping_methods'::regclass
    ) then
      alter table public.shipping_methods
        add constraint shipping_methods_status_check
        check (status is null or status in ('active', 'inactive'));
    end if;
  end if;
end $$;

create unique index if not exists shipping_profiles_one_default_idx
  on public.shipping_profiles(store_id)
  where is_default = true;

create index if not exists shipping_profiles_workspace_store_idx
  on public.shipping_profiles(workspace_id, store_id, status, sort_order);

create index if not exists shipping_zones_profile_idx
  on public.shipping_zones(workspace_id, store_id, profile_id, status, sort_order);

create index if not exists shipping_methods_profile_idx
  on public.shipping_methods(workspace_id, store_id, profile_id, status, sort_order);

alter table public.shipping_profiles enable row level security;
alter table public.shipping_zones enable row level security;
alter table public.shipping_methods enable row level security;

drop policy if exists "workspace members read shipping profiles" on public.shipping_profiles;
drop policy if exists "workspace editors write shipping profiles" on public.shipping_profiles;
drop policy if exists "public can read published store shipping profiles" on public.shipping_profiles;
drop policy if exists "workspace members read shipping zones" on public.shipping_zones;
drop policy if exists "workspace editors write shipping zones" on public.shipping_zones;
drop policy if exists "public can read published store shipping zones" on public.shipping_zones;
drop policy if exists "workspace members read shipping methods" on public.shipping_methods;
drop policy if exists "workspace editors write shipping methods" on public.shipping_methods;
drop policy if exists "public can read published store shipping methods" on public.shipping_methods;

create policy "workspace members read shipping profiles"
on public.shipping_profiles for select to authenticated
using (public.can_access_workspace(workspace_id));

create policy "workspace editors write shipping profiles"
on public.shipping_profiles for all to authenticated
using (public.workspace_can_edit(workspace_id))
with check (public.workspace_can_edit(workspace_id));

create policy "public can read published store shipping profiles"
on public.shipping_profiles for select to anon, authenticated
using (
  status = 'active'
  and exists (
    select 1 from public.stores stores
    where stores.id = shipping_profiles.store_id
      and stores.status = 'published'
  )
);

create policy "workspace members read shipping zones"
on public.shipping_zones for select to authenticated
using (public.can_access_workspace(workspace_id));

create policy "workspace editors write shipping zones"
on public.shipping_zones for all to authenticated
using (public.workspace_can_edit(workspace_id))
with check (public.workspace_can_edit(workspace_id));

create policy "public can read published store shipping zones"
on public.shipping_zones for select to anon, authenticated
using (
  status = 'active'
  and exists (
    select 1 from public.stores stores
    where stores.id = shipping_zones.store_id
      and stores.status = 'published'
  )
);

create policy "workspace members read shipping methods"
on public.shipping_methods for select to authenticated
using (workspace_id is not null and public.can_access_workspace(workspace_id));

create policy "workspace editors write shipping methods"
on public.shipping_methods for all to authenticated
using (workspace_id is not null and public.workspace_can_edit(workspace_id))
with check (workspace_id is not null and public.workspace_can_edit(workspace_id));

create policy "public can read published store shipping methods"
on public.shipping_methods for select to anon, authenticated
using (
  status = 'active'
  and store_id is not null
  and exists (
    select 1 from public.stores stores
    where stores.id = shipping_methods.store_id
      and stores.status = 'published'
  )
);
