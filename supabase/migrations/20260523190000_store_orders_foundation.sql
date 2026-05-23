-- Store Mode real orders foundation.
-- Creates owner-scoped order records for public storefront checkout submissions.

create extension if not exists "pgcrypto";

create table if not exists public.store_orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  owner_user_id uuid references auth.users(id) on delete set null,
  customer_name text not null,
  customer_phone text not null,
  customer_email text,
  customer_address text,
  items jsonb not null default '[]'::jsonb,
  subtotal numeric(12, 2) not null default 0 check (subtotal >= 0),
  total numeric(12, 2) not null default 0 check (total >= 0),
  payment_method text not null default 'whatsapp',
  payment_status text not null default 'pending',
  order_status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists store_orders_store_created_idx
on public.store_orders(store_id, created_at desc);

create index if not exists store_orders_owner_created_idx
on public.store_orders(owner_user_id, created_at desc);

create index if not exists store_orders_user_created_idx
on public.store_orders(user_id, created_at desc);

alter table public.store_orders enable row level security;

drop policy if exists "store owners read own store orders" on public.store_orders;
drop policy if exists "store owners update own store orders" on public.store_orders;

create policy "store owners read own store orders"
on public.store_orders
for select
to authenticated
using (auth.uid() = owner_user_id or auth.uid() = user_id);

create policy "store owners update own store orders"
on public.store_orders
for update
to authenticated
using (auth.uid() = owner_user_id or auth.uid() = user_id)
with check (auth.uid() = owner_user_id or auth.uid() = user_id);

create or replace function public.set_store_orders_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists store_orders_updated_at on public.store_orders;
create trigger store_orders_updated_at
before update on public.store_orders
for each row execute function public.set_store_orders_updated_at();
