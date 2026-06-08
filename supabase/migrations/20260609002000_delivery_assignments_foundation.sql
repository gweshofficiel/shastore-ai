-- Delivery assignment foundation.
-- Additive only: creates store-scoped assignment records for delivery users.

create table if not exists public.delivery_assignments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  store_id uuid not null references public.stores(id) on delete cascade,
  order_source text not null check (order_source in ('orders', 'store_orders')),
  order_id uuid not null,
  delivery_agent_id uuid not null references public.store_delivery_agents(id) on delete cascade,
  assigned_by uuid references auth.users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  status text not null default 'assigned' check (status in ('assigned', 'accepted', 'picked_up', 'delivered', 'returned')),
  notes text,
  order_number text,
  customer_name text,
  customer_phone text,
  customer_city text,
  order_amount numeric(12, 2) not null default 0,
  currency text not null default 'USD',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists delivery_assignments_order_unique_idx
on public.delivery_assignments(order_source, order_id);

create index if not exists delivery_assignments_agent_idx
on public.delivery_assignments(delivery_agent_id, status, assigned_at desc);

create index if not exists delivery_assignments_workspace_store_idx
on public.delivery_assignments(workspace_id, store_id, assigned_at desc);

create or replace function public.set_delivery_assignments_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.customer_city = nullif(trim(coalesce(new.customer_city, '')), '');
  new.customer_name = nullif(trim(coalesce(new.customer_name, '')), '');
  new.customer_phone = nullif(trim(coalesce(new.customer_phone, '')), '');
  new.notes = nullif(trim(coalesce(new.notes, '')), '');
  new.order_number = nullif(trim(coalesce(new.order_number, '')), '');
  new.currency = upper(nullif(trim(coalesce(new.currency, '')), ''));

  if new.currency is null then
    new.currency = 'USD';
  end if;

  return new;
end;
$$;

drop trigger if exists delivery_assignments_updated_at on public.delivery_assignments;
create trigger delivery_assignments_updated_at
before insert or update on public.delivery_assignments
for each row execute function public.set_delivery_assignments_updated_at();

alter table public.delivery_assignments enable row level security;

drop policy if exists "workspace members read delivery assignments" on public.delivery_assignments;
drop policy if exists "workspace editors write delivery assignments" on public.delivery_assignments;
drop policy if exists "delivery agents read own assignments" on public.delivery_assignments;

create policy "workspace members read delivery assignments"
on public.delivery_assignments for select to authenticated
using (public.can_access_workspace(workspace_id));

create policy "workspace editors write delivery assignments"
on public.delivery_assignments for all to authenticated
using (public.workspace_can_edit(workspace_id))
with check (public.workspace_can_edit(workspace_id));

create policy "delivery agents read own assignments"
on public.delivery_assignments for select to authenticated
using (
  exists (
    select 1
    from public.store_delivery_agents agents
    where agents.id = delivery_assignments.delivery_agent_id
      and agents.store_id = delivery_assignments.store_id
      and agents.status = 'active'
      and agents.metadata->>'auth_user_id' = auth.uid()::text
  )
);
