-- Store owner orders foundation.
-- Additive only: creates isolated ecommerce order records for claimed store owners.

create extension if not exists "pgcrypto";

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  store_instance_id uuid not null references public.store_instances(id) on delete cascade,
  order_number text not null,
  customer_reference text,
  customer_name text,
  customer_email text,
  customer_phone text,
  order_status text not null default 'pending'
    check (order_status in ('pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded')),
  payment_status text not null default 'pending'
    check (payment_status in ('pending', 'paid', 'refunded')),
  fulfillment_status text not null default 'pending'
    check (fulfillment_status in ('pending', 'processing', 'shipped', 'delivered', 'cancelled')),
  currency text not null default 'USD',
  subtotal numeric(12, 2) not null default 0
    check (subtotal >= 0),
  total numeric(12, 2) not null default 0
    check (total >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_instance_id, order_number)
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  store_instance_id uuid not null references public.store_instances(id) on delete cascade,
  product_reference text,
  product_title text not null,
  quantity integer not null default 1
    check (quantity > 0),
  unit_price numeric(12, 2) not null default 0
    check (unit_price >= 0),
  total_price numeric(12, 2) not null default 0
    check (total_price >= 0),
  created_at timestamptz not null default now()
);

create index if not exists orders_store_created_idx
  on public.orders(store_instance_id, created_at desc);

create index if not exists orders_store_status_idx
  on public.orders(store_instance_id, order_status, created_at desc);

create index if not exists order_items_order_idx
  on public.order_items(order_id);

create index if not exists order_items_store_idx
  on public.order_items(store_instance_id, created_at desc);

alter table public.orders enable row level security;
alter table public.order_items enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'orders'
      and policyname = 'Buyer store members read orders'
  ) then
    create policy "Buyer store members read orders"
      on public.orders for select
      using (public.can_access_store_instance(store_instance_id));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'orders'
      and policyname = 'Buyer store managers update orders'
  ) then
    create policy "Buyer store managers update orders"
      on public.orders for update
      using (public.can_manage_store_instance(store_instance_id))
      with check (public.can_manage_store_instance(store_instance_id));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'order_items'
      and policyname = 'Buyer store members read order items'
  ) then
    create policy "Buyer store members read order items"
      on public.order_items for select
      using (public.can_access_store_instance(store_instance_id));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'order_items'
      and policyname = 'Buyer store managers update order items'
  ) then
    create policy "Buyer store managers update order items"
      on public.order_items for update
      using (public.can_manage_store_instance(store_instance_id))
      with check (public.can_manage_store_instance(store_instance_id));
  end if;
end $$;

create or replace function public.set_store_owner_orders_updated_at()
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
  if not exists (select 1 from pg_trigger where tgname = 'orders_updated_at') then
    create trigger orders_updated_at
      before update on public.orders
      for each row execute function public.set_store_owner_orders_updated_at();
  end if;
end $$;

