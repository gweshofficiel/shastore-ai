-- Delivery route management and capacity foundation.
-- Additive only: store-scoped delivery zones plus agent capacity/availability fields.

create table if not exists public.delivery_zones (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  city text,
  region text,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.store_delivery_agents
  add column if not exists availability_status text not null default 'offline',
  add column if not exists capacity_limit integer not null default 5,
  add column if not exists current_active_orders integer not null default 0,
  add column if not exists assigned_zone_ids uuid[] not null default '{}'::uuid[];

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'store_delivery_agents_availability_status_check'
  ) then
    alter table public.store_delivery_agents
      add constraint store_delivery_agents_availability_status_check
      check (availability_status in ('online', 'offline', 'busy'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'store_delivery_agents_capacity_limit_check'
  ) then
    alter table public.store_delivery_agents
      add constraint store_delivery_agents_capacity_limit_check
      check (capacity_limit >= 0 and capacity_limit <= 500);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'store_delivery_agents_current_active_orders_check'
  ) then
    alter table public.store_delivery_agents
      add constraint store_delivery_agents_current_active_orders_check
      check (current_active_orders >= 0);
  end if;
end $$;

create unique index if not exists delivery_zones_store_name_unique_idx
on public.delivery_zones(store_id, lower(name));

create index if not exists delivery_zones_workspace_store_idx
on public.delivery_zones(workspace_id, store_id, is_active, created_at desc);

create index if not exists store_delivery_agents_capacity_idx
on public.store_delivery_agents(workspace_id, store_id, availability_status, capacity_limit);

create index if not exists store_delivery_agents_assigned_zone_ids_idx
on public.store_delivery_agents using gin(assigned_zone_ids);

create or replace function public.set_delivery_zones_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.name = nullif(trim(coalesce(new.name, '')), '');
  new.city = nullif(trim(coalesce(new.city, '')), '');
  new.region = nullif(trim(coalesce(new.region, '')), '');

  if new.name is null then
    raise exception 'delivery zone name is required';
  end if;

  return new;
end;
$$;

drop trigger if exists delivery_zones_updated_at on public.delivery_zones;
create trigger delivery_zones_updated_at
before insert or update on public.delivery_zones
for each row execute function public.set_delivery_zones_updated_at();

create or replace function public.set_store_delivery_agents_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.phone = trim(new.phone);
  new.normalized_phone = nullif(regexp_replace(coalesce(new.phone, ''), '[^0-9+]', '', 'g'), '');
  new.email = nullif(lower(trim(coalesce(new.email, ''))), '');
  new.normalized_email = new.email;
  new.city_zone = nullif(trim(coalesce(new.city_zone, '')), '');
  new.availability_status = coalesce(new.availability_status, 'offline');
  new.capacity_limit = greatest(coalesce(new.capacity_limit, 5), 0);
  new.current_active_orders = greatest(coalesce(new.current_active_orders, 0), 0);
  new.assigned_zone_ids = coalesce(new.assigned_zone_ids, '{}'::uuid[]);
  return new;
end;
$$;

alter table public.delivery_zones enable row level security;

drop policy if exists "workspace members read delivery zones" on public.delivery_zones;
drop policy if exists "workspace editors write delivery zones" on public.delivery_zones;
drop policy if exists "delivery agents read assigned zones" on public.delivery_zones;

create policy "workspace members read delivery zones"
on public.delivery_zones for select to authenticated
using (public.can_access_workspace(workspace_id));

create policy "workspace editors write delivery zones"
on public.delivery_zones for all to authenticated
using (public.workspace_can_edit(workspace_id))
with check (public.workspace_can_edit(workspace_id));

create policy "delivery agents read assigned zones"
on public.delivery_zones for select to authenticated
using (
  exists (
    select 1
    from public.store_delivery_agents agents
    where agents.store_id = delivery_zones.store_id
      and agents.status = 'active'
      and delivery_zones.id = any(agents.assigned_zone_ids)
      and agents.metadata->>'auth_user_id' = auth.uid()::text
  )
);

alter table public.store_delivery_events
  drop constraint if exists store_delivery_events_event_type_check;

alter table public.store_delivery_events
  add constraint store_delivery_events_event_type_check
  check (
    event_type in (
      'delivery_assigned',
      'delivery_agent_changed',
      'delivery_status_changed',
      'cash_collected',
      'cash_settled',
      'cash_dispute_opened',
      'delivery_failed',
      'customer_refused',
      'wrong_address',
      'return_started',
      'returned_to_store',
      'return_completed',
      'reschedule_requested',
      'reschedule_approved',
      'delivery_zone_created',
      'delivery_capacity_updated',
      'delivery_availability_changed'
    )
  );
