-- Stabilize public storefront order draft inserts against legacy orders/order_items schemas.
-- Additive only: does not replace store_orders or activate payments.

create extension if not exists "pgcrypto";

-- Ensure storefront draft columns exist on orders.
alter table if exists public.orders
  add column if not exists store_id uuid references public.stores(id) on delete cascade,
  add column if not exists customer_address text,
  add column if not exists payment_method text,
  add column if not exists source text;

-- Legacy owner-order schema requires order_number; make it safe for draft inserts.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'orders'
      and column_name = 'order_number'
  ) then
    alter table public.orders alter column order_number drop not null;
    alter table public.orders alter column order_number set default '';
    update public.orders
    set order_number = coalesce(nullif(order_number, ''), 'LEGACY-' || left(id::text, 8))
    where order_number is null or order_number = '';
  end if;
end $$;

-- Allow draft status for public checkout preparation.
do $$
declare
  constraint_row record;
begin
  if to_regclass('public.orders') is null then
    return;
  end if;

  for constraint_row in
    select c.conname
    from pg_constraint c
    where c.conrelid = 'public.orders'::regclass
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%order_status%'
  loop
    execute format('alter table public.orders drop constraint if exists %I', constraint_row.conname);
  end loop;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'orders_public_status_check'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_public_status_check
      check (
        order_status in (
          'draft',
          'pending',
          'paid',
          'processing',
          'shipped',
          'delivered',
          'cancelled',
          'refunded',
          'confirmed'
        )
      );
  end if;
end $$;

-- Store-mode stores use stores.id; repoint legacy store_instance_id FK when possible.
do $$
declare
  fk_name text;
begin
  if to_regclass('public.orders') is null or to_regclass('public.stores') is null then
    return;
  end if;

  if to_regclass('public.store_instances') is null then
    return;
  end if;

  select c.conname
  into fk_name
  from pg_constraint c
  where c.conrelid = 'public.orders'::regclass
    and c.contype = 'f'
    and c.confrelid = 'public.store_instances'::regclass
  limit 1;

  if fk_name is not null then
    execute format('alter table public.orders drop constraint %I', fk_name);
    alter table public.orders
      add constraint orders_store_instance_id_fkey
      foreign key (store_instance_id) references public.stores(id) on delete cascade;
  end if;
exception
  when others then
    raise notice 'orders store_instance_id FK repoint skipped: %', sqlerrm;
end $$;

alter table if exists public.orders
  alter column store_instance_id drop not null;

-- order_items compatibility for legacy unit_price/total_price columns.
alter table if exists public.order_items
  add column if not exists store_id uuid references public.stores(id) on delete cascade,
  add column if not exists product_id uuid,
  add column if not exists product_image text,
  add column if not exists price numeric(12, 2) not null default 0,
  add column if not exists subtotal numeric(12, 2) not null default 0,
  add column if not exists currency text not null default 'USD';

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'order_items'
      and column_name = 'unit_price'
  ) then
    execute $sql$
      update public.order_items
      set unit_price = coalesce(unit_price, price, 0)
      where unit_price is null
    $sql$;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'order_items'
      and column_name = 'total_price'
  ) then
    execute $sql$
      update public.order_items
      set total_price = coalesce(total_price, subtotal, 0)
      where total_price is null
    $sql$;
  end if;
end $$;

alter table if exists public.order_items
  alter column store_instance_id drop not null;

-- Service-role draft inserts (public checkout uses server action admin client).
drop policy if exists "service role insert storefront order drafts" on public.orders;
drop policy if exists "service role insert storefront order draft items" on public.order_items;

create policy "service role insert storefront order drafts"
on public.orders
for insert
to service_role
with check (true);

create policy "service role insert storefront order draft items"
on public.order_items
for insert
to service_role
with check (true);
