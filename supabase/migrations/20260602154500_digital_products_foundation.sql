-- Digital products foundation.
-- Additive only: keeps existing product, checkout, order, permissions, and audit systems intact.

alter table if exists public.store_products
  add column if not exists product_type text not null default 'physical',
  add column if not exists requires_shipping boolean not null default true,
  add column if not exists digital_file_name text,
  add column if not exists digital_file_path text,
  add column if not exists digital_file_bucket text,
  add column if not exists digital_file_size bigint check (digital_file_size is null or digital_file_size >= 0),
  add column if not exists digital_file_type text,
  add column if not exists digital_delivery_enabled boolean not null default false;

update public.store_products
set
  product_type = coalesce(nullif(product_type, ''), 'physical'),
  requires_shipping = case
    when coalesce(nullif(product_type, ''), 'physical') = 'digital' then false
    else coalesce(requires_shipping, true)
  end,
  digital_delivery_enabled = case
    when coalesce(nullif(product_type, ''), 'physical') = 'digital'
      and nullif(digital_file_path, '') is not null
    then true
    else coalesce(digital_delivery_enabled, false)
  end;

do $$
begin
  if to_regclass('public.store_products') is not null then
    if not exists (
      select 1
      from pg_constraint
      where conname = 'store_products_product_type_check'
        and conrelid = 'public.store_products'::regclass
    ) then
      alter table public.store_products
        add constraint store_products_product_type_check
        check (product_type in ('physical', 'digital'));
    end if;
  end if;
end $$;

create index if not exists store_products_type_idx
on public.store_products(workspace_id, store_id, product_type, status);

alter table if exists public.orders
  add column if not exists delivery_type text not null default 'physical',
  add column if not exists has_digital_items boolean not null default false,
  add column if not exists digital_delivery_status text not null default 'none',
  add column if not exists digital_delivery_metadata jsonb not null default '{}'::jsonb;

alter table if exists public.store_orders
  add column if not exists delivery_type text not null default 'physical',
  add column if not exists has_digital_items boolean not null default false,
  add column if not exists digital_delivery_status text not null default 'none',
  add column if not exists digital_delivery_metadata jsonb not null default '{}'::jsonb;

alter table if exists public.order_items
  add column if not exists product_type text not null default 'physical',
  add column if not exists digital_delivery_status text not null default 'none',
  add column if not exists digital_file_name text;

do $$
begin
  if to_regclass('public.orders') is not null then
    if not exists (
      select 1
      from pg_constraint
      where conname = 'orders_delivery_type_check'
        and conrelid = 'public.orders'::regclass
    ) then
      alter table public.orders
        add constraint orders_delivery_type_check
        check (delivery_type in ('physical', 'digital', 'mixed'));
    end if;

    if not exists (
      select 1
      from pg_constraint
      where conname = 'orders_digital_delivery_status_check'
        and conrelid = 'public.orders'::regclass
    ) then
      alter table public.orders
        add constraint orders_digital_delivery_status_check
        check (digital_delivery_status in ('none', 'pending', 'ready', 'delivered'));
    end if;
  end if;

  if to_regclass('public.store_orders') is not null then
    if not exists (
      select 1
      from pg_constraint
      where conname = 'store_orders_delivery_type_check'
        and conrelid = 'public.store_orders'::regclass
    ) then
      alter table public.store_orders
        add constraint store_orders_delivery_type_check
        check (delivery_type in ('physical', 'digital', 'mixed'));
    end if;

    if not exists (
      select 1
      from pg_constraint
      where conname = 'store_orders_digital_delivery_status_check'
        and conrelid = 'public.store_orders'::regclass
    ) then
      alter table public.store_orders
        add constraint store_orders_digital_delivery_status_check
        check (digital_delivery_status in ('none', 'pending', 'ready', 'delivered'));
    end if;
  end if;

  if to_regclass('public.order_items') is not null then
    if not exists (
      select 1
      from pg_constraint
      where conname = 'order_items_product_type_check'
        and conrelid = 'public.order_items'::regclass
    ) then
      alter table public.order_items
        add constraint order_items_product_type_check
        check (product_type in ('physical', 'digital'));
    end if;

    if not exists (
      select 1
      from pg_constraint
      where conname = 'order_items_digital_delivery_status_check'
        and conrelid = 'public.order_items'::regclass
    ) then
      alter table public.order_items
        add constraint order_items_digital_delivery_status_check
        check (digital_delivery_status in ('none', 'pending', 'ready', 'delivered'));
    end if;
  end if;
end $$;

create index if not exists orders_digital_delivery_idx
on public.orders(workspace_id, has_digital_items, digital_delivery_status, created_at desc);

create index if not exists store_orders_digital_delivery_idx
on public.store_orders(workspace_id, has_digital_items, digital_delivery_status, created_at desc);
