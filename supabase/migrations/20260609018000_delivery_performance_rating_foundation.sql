-- Delivery performance and rating foundation.
-- Additive only: delivery-agent metrics snapshots plus customer delivery ratings.

create table if not exists public.delivery_agent_performance (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  store_id uuid not null references public.stores(id) on delete cascade,
  delivery_agent_id uuid not null references public.store_delivery_agents(id) on delete cascade,
  total_assigned_orders integer not null default 0,
  total_delivered_orders integer not null default 0,
  total_returned_orders integer not null default 0,
  total_failed_orders integer not null default 0,
  success_rate numeric(6, 2) not null default 0,
  return_rate numeric(6, 2) not null default 0,
  average_delivery_time numeric(12, 2) not null default 0,
  rating_average numeric(3, 2) not null default 0,
  rating_count integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  recalculated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.delivery_ratings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  store_id uuid not null references public.stores(id) on delete cascade,
  delivery_agent_id uuid not null references public.store_delivery_agents(id) on delete cascade,
  order_source text not null check (order_source in ('orders', 'store_orders')),
  order_id uuid not null,
  rating integer not null check (rating in (1, 2, 3, 4, 5)),
  comment text,
  customer_phone text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists delivery_agent_performance_agent_unique_idx
on public.delivery_agent_performance(delivery_agent_id);

create index if not exists delivery_agent_performance_store_idx
on public.delivery_agent_performance(workspace_id, store_id, success_rate desc, rating_average desc);

create unique index if not exists delivery_ratings_agent_order_unique_idx
on public.delivery_ratings(delivery_agent_id, order_source, order_id);

create index if not exists delivery_ratings_store_idx
on public.delivery_ratings(workspace_id, store_id, created_at desc);

create index if not exists delivery_ratings_agent_idx
on public.delivery_ratings(delivery_agent_id, created_at desc);

create or replace function public.set_delivery_performance_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.total_assigned_orders = greatest(coalesce(new.total_assigned_orders, 0), 0);
  new.total_delivered_orders = greatest(coalesce(new.total_delivered_orders, 0), 0);
  new.total_returned_orders = greatest(coalesce(new.total_returned_orders, 0), 0);
  new.total_failed_orders = greatest(coalesce(new.total_failed_orders, 0), 0);
  new.success_rate = greatest(coalesce(new.success_rate, 0), 0);
  new.return_rate = greatest(coalesce(new.return_rate, 0), 0);
  new.average_delivery_time = greatest(coalesce(new.average_delivery_time, 0), 0);
  new.rating_average = greatest(coalesce(new.rating_average, 0), 0);
  new.rating_count = greatest(coalesce(new.rating_count, 0), 0);
  return new;
end;
$$;

drop trigger if exists delivery_agent_performance_updated_at on public.delivery_agent_performance;
create trigger delivery_agent_performance_updated_at
before insert or update on public.delivery_agent_performance
for each row execute function public.set_delivery_performance_updated_at();

create or replace function public.set_delivery_ratings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.comment = nullif(trim(coalesce(new.comment, '')), '');
  new.customer_phone = nullif(trim(coalesce(new.customer_phone, '')), '');
  return new;
end;
$$;

drop trigger if exists delivery_ratings_updated_at on public.delivery_ratings;
create trigger delivery_ratings_updated_at
before insert or update on public.delivery_ratings
for each row execute function public.set_delivery_ratings_updated_at();

alter table public.delivery_agent_performance enable row level security;
alter table public.delivery_ratings enable row level security;

drop policy if exists "workspace members read delivery performance" on public.delivery_agent_performance;
drop policy if exists "workspace editors write delivery performance" on public.delivery_agent_performance;
drop policy if exists "delivery agents read own performance" on public.delivery_agent_performance;
drop policy if exists "workspace members read delivery ratings" on public.delivery_ratings;
drop policy if exists "workspace editors write delivery ratings" on public.delivery_ratings;
drop policy if exists "delivery agents read own ratings" on public.delivery_ratings;

create policy "workspace members read delivery performance"
on public.delivery_agent_performance for select to authenticated
using (public.can_access_workspace(workspace_id));

create policy "workspace editors write delivery performance"
on public.delivery_agent_performance for all to authenticated
using (public.workspace_can_edit(workspace_id))
with check (public.workspace_can_edit(workspace_id));

create policy "delivery agents read own performance"
on public.delivery_agent_performance for select to authenticated
using (
  exists (
    select 1
    from public.store_delivery_agents agents
    where agents.id = delivery_agent_performance.delivery_agent_id
      and agents.store_id = delivery_agent_performance.store_id
      and agents.status = 'active'
      and agents.metadata->>'auth_user_id' = auth.uid()::text
  )
);

create policy "workspace members read delivery ratings"
on public.delivery_ratings for select to authenticated
using (public.can_access_workspace(workspace_id));

create policy "workspace editors write delivery ratings"
on public.delivery_ratings for all to authenticated
using (public.workspace_can_edit(workspace_id))
with check (public.workspace_can_edit(workspace_id));

create policy "delivery agents read own ratings"
on public.delivery_ratings for select to authenticated
using (
  exists (
    select 1
    from public.store_delivery_agents agents
    where agents.id = delivery_ratings.delivery_agent_id
      and agents.store_id = delivery_ratings.store_id
      and agents.status = 'active'
      and agents.metadata->>'auth_user_id' = auth.uid()::text
  )
);
