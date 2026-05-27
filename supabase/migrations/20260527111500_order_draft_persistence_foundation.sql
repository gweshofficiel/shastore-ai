-- Public storefront order draft persistence foundation.
-- Additive only: does not replace store_orders or activate payments.

create extension if not exists "pgcrypto";

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  store_instance_id uuid references public.stores(id) on delete cascade,
  workspace_id uuid,
  user_id uuid references auth.users(id) on delete set null,
  owner_user_id uuid references auth.users(id) on delete set null,
  customer_name text not null,
  customer_phone text not null,
  customer_email text,
  customer_address text,
  notes text,
  subtotal numeric(12, 2) not null default 0 check (subtotal >= 0),
  total numeric(12, 2) not null default 0 check (total >= 0),
  currency text not null default 'USD',
  order_status text not null default 'draft',
  payment_method text not null default 'manual',
  payment_status text not null default 'pending',
  fulfillment_status text not null default 'pending',
  source text not null default 'public_storefront',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.orders
  add column if not exists store_id uuid references public.stores(id) on delete cascade,
  add column if not exists store_instance_id uuid references public.stores(id) on delete cascade,
  add column if not exists workspace_id uuid,
  add column if not exists user_id uuid references auth.users(id) on delete set null,
  add column if not exists owner_user_id uuid references auth.users(id) on delete set null,
  add column if not exists customer_name text,
  add column if not exists customer_phone text,
  add column if not exists customer_email text,
  add column if not exists customer_address text,
  add column if not exists notes text,
  add column if not exists subtotal numeric(12, 2) not null default 0,
  add column if not exists total numeric(12, 2) not null default 0,
  add column if not exists currency text not null default 'USD',
  add column if not exists order_status text not null default 'draft',
  add column if not exists payment_method text not null default 'manual',
  add column if not exists payment_status text not null default 'pending',
  add column if not exists fulfillment_status text not null default 'pending',
  add column if not exists source text not null default 'public_storefront',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update public.orders orders
set
  store_instance_id = coalesce(orders.store_instance_id, orders.store_id),
  workspace_id = coalesce(orders.workspace_id, stores.workspace_id, orders.owner_user_id, orders.user_id),
  owner_user_id = coalesce(orders.owner_user_id, stores.owner_user_id, stores.user_id),
  user_id = coalesce(orders.user_id, stores.user_id),
  currency = coalesce(nullif(orders.currency, ''), stores.currency, 'USD')
from public.stores stores
where orders.store_id = stores.id;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_status_check'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_status_check
      check (order_status in ('draft', 'pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'));
  end if;
end $$;

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  store_id uuid references public.stores(id) on delete cascade,
  workspace_id uuid,
  product_id uuid,
  product_title text not null,
  product_image text,
  price numeric(12, 2) not null default 0 check (price >= 0),
  quantity integer not null default 1 check (quantity > 0),
  subtotal numeric(12, 2) not null default 0 check (subtotal >= 0),
  currency text not null default 'USD',
  created_at timestamptz not null default now()
);

alter table if exists public.order_items
  add column if not exists order_id uuid references public.orders(id) on delete cascade,
  add column if not exists store_id uuid references public.stores(id) on delete cascade,
  add column if not exists workspace_id uuid,
  add column if not exists product_id uuid,
  add column if not exists product_title text,
  add column if not exists product_image text,
  add column if not exists price numeric(12, 2) not null default 0,
  add column if not exists quantity integer not null default 1,
  add column if not exists subtotal numeric(12, 2) not null default 0,
  add column if not exists currency text not null default 'USD',
  add column if not exists created_at timestamptz not null default now();

create index if not exists orders_store_created_idx
on public.orders(store_id, created_at desc);

create index if not exists orders_workspace_created_idx
on public.orders(workspace_id, created_at desc);

create index if not exists orders_status_created_idx
on public.orders(order_status, created_at desc);

create index if not exists order_items_order_idx
on public.order_items(order_id);

create index if not exists order_items_store_idx
on public.order_items(store_id);

alter table public.orders enable row level security;
alter table public.order_items enable row level security;

drop policy if exists "workspace members read orders" on public.orders;
drop policy if exists "workspace managers update orders" on public.orders;
drop policy if exists "workspace members read order items" on public.order_items;
drop policy if exists "workspace managers update order items" on public.order_items;

create policy "workspace members read orders"
on public.orders
for select
to authenticated
using (
  public.can_access_workspace(workspace_id)
  or auth.uid() = owner_user_id
  or auth.uid() = user_id
);

create policy "workspace managers update orders"
on public.orders
for update
to authenticated
using (public.workspace_can_edit(workspace_id))
with check (public.workspace_can_edit(workspace_id));

create policy "workspace members read order items"
on public.order_items
for select
to authenticated
using (
  exists (
    select 1
    from public.orders orders
    where orders.id = order_items.order_id
      and (
        public.can_access_workspace(orders.workspace_id)
        or auth.uid() = orders.owner_user_id
        or auth.uid() = orders.user_id
      )
  )
);

create policy "workspace managers update order items"
on public.order_items
for update
to authenticated
using (
  exists (
    select 1
    from public.orders orders
    where orders.id = order_items.order_id
      and public.workspace_can_edit(orders.workspace_id)
  )
)
with check (
  exists (
    select 1
    from public.orders orders
    where orders.id = order_items.order_id
      and public.workspace_can_edit(orders.workspace_id)
  )
);

create or replace function public.set_orders_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists orders_updated_at on public.orders;
create trigger orders_updated_at
before update on public.orders
for each row execute function public.set_orders_updated_at();
