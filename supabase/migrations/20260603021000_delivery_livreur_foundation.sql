-- Delivery / livreur foundation.
-- Additive only: store-scoped delivery agents, order assignment fields, and delivery timeline events.

create table if not exists public.store_delivery_agents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  phone text not null,
  normalized_phone text not null,
  email text,
  normalized_email text,
  city_zone text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.store_delivery_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  store_id uuid not null references public.stores(id) on delete cascade,
  order_source text not null check (order_source in ('orders', 'store_orders')),
  order_id uuid not null,
  delivery_agent_id uuid references public.store_delivery_agents(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null check (event_type in ('delivery_assigned', 'delivery_agent_changed', 'delivery_status_changed')),
  previous_value text,
  new_value text,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table if exists public.store_orders
  add column if not exists delivery_agent_id uuid references public.store_delivery_agents(id) on delete set null,
  add column if not exists delivery_status text check (delivery_status is null or delivery_status in ('assigned', 'picked_up', 'out_for_delivery', 'delivered', 'failed')),
  add column if not exists delivery_assigned_at timestamptz,
  add column if not exists delivery_picked_up_at timestamptz,
  add column if not exists delivery_out_for_delivery_at timestamptz,
  add column if not exists delivery_delivered_at timestamptz,
  add column if not exists delivery_failed_at timestamptz;

alter table if exists public.orders
  add column if not exists delivery_agent_id uuid references public.store_delivery_agents(id) on delete set null,
  add column if not exists delivery_status text check (delivery_status is null or delivery_status in ('assigned', 'picked_up', 'out_for_delivery', 'delivered', 'failed')),
  add column if not exists delivery_assigned_at timestamptz,
  add column if not exists delivery_picked_up_at timestamptz,
  add column if not exists delivery_out_for_delivery_at timestamptz,
  add column if not exists delivery_delivered_at timestamptz,
  add column if not exists delivery_failed_at timestamptz;

create unique index if not exists store_delivery_agents_store_phone_unique_idx
on public.store_delivery_agents(store_id, normalized_phone);

create index if not exists store_delivery_agents_workspace_store_idx
on public.store_delivery_agents(workspace_id, store_id, status, created_at desc);

create index if not exists store_delivery_events_order_idx
on public.store_delivery_events(workspace_id, store_id, order_source, order_id, created_at desc);

create index if not exists store_delivery_events_agent_idx
on public.store_delivery_events(workspace_id, store_id, delivery_agent_id, created_at desc)
where delivery_agent_id is not null;

create index if not exists store_orders_delivery_agent_idx
on public.store_orders(delivery_agent_id)
where delivery_agent_id is not null;

create index if not exists orders_delivery_agent_idx
on public.orders(delivery_agent_id)
where delivery_agent_id is not null;

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
  return new;
end;
$$;

drop trigger if exists store_delivery_agents_updated_at on public.store_delivery_agents;
create trigger store_delivery_agents_updated_at
before insert or update on public.store_delivery_agents
for each row execute function public.set_store_delivery_agents_updated_at();

alter table public.store_delivery_agents enable row level security;
alter table public.store_delivery_events enable row level security;

drop policy if exists "workspace members read delivery agents" on public.store_delivery_agents;
drop policy if exists "workspace editors write delivery agents" on public.store_delivery_agents;
drop policy if exists "workspace members read delivery events" on public.store_delivery_events;
drop policy if exists "workspace editors write delivery events" on public.store_delivery_events;

create policy "workspace members read delivery agents"
on public.store_delivery_agents for select to authenticated
using (public.can_access_workspace(workspace_id));

create policy "workspace editors write delivery agents"
on public.store_delivery_agents for all to authenticated
using (public.workspace_can_edit(workspace_id))
with check (public.workspace_can_edit(workspace_id));

create policy "workspace members read delivery events"
on public.store_delivery_events for select to authenticated
using (public.can_access_workspace(workspace_id));

create policy "workspace editors write delivery events"
on public.store_delivery_events for all to authenticated
using (public.workspace_can_edit(workspace_id))
with check (public.workspace_can_edit(workspace_id));
