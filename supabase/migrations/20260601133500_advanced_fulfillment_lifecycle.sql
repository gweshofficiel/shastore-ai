-- Advanced fulfillment lifecycle.
-- Targeted only: extends fulfillment status values and timestamps without resetting data or changing RLS.

alter table if exists public.orders
  alter column fulfillment_status set default 'pending',
  add column if not exists shipped_at timestamptz,
  add column if not exists delivered_at timestamptz;

alter table if exists public.store_orders
  alter column fulfillment_status set default 'pending',
  add column if not exists shipped_at timestamptz,
  add column if not exists delivered_at timestamptz;

do $$
declare
  constraint_row record;
begin
  if to_regclass('public.orders') is not null then
    for constraint_row in
      select c.conname
      from pg_constraint c
      where c.conrelid = 'public.orders'::regclass
        and c.contype = 'c'
        and pg_get_constraintdef(c.oid) ilike '%fulfillment_status%'
    loop
      execute format('alter table public.orders drop constraint if exists %I', constraint_row.conname);
    end loop;

    alter table public.orders
      add constraint orders_fulfillment_status_check
      check (
        fulfillment_status in (
          'pending',
          'processing',
          'preparing',
          'ready_for_pickup',
          'shipped',
          'out_for_delivery',
          'delivered',
          'cancelled',
          'returned',
          'refunded',
          'unfulfilled',
          'fulfilled'
        )
      )
      not valid;
  end if;

  if to_regclass('public.store_orders') is not null then
    for constraint_row in
      select c.conname
      from pg_constraint c
      where c.conrelid = 'public.store_orders'::regclass
        and c.contype = 'c'
        and pg_get_constraintdef(c.oid) ilike '%fulfillment_status%'
    loop
      execute format('alter table public.store_orders drop constraint if exists %I', constraint_row.conname);
    end loop;

    alter table public.store_orders
      add constraint store_orders_fulfillment_status_check
      check (
        fulfillment_status in (
          'pending',
          'processing',
          'preparing',
          'ready_for_pickup',
          'shipped',
          'out_for_delivery',
          'delivered',
          'cancelled',
          'returned',
          'refunded',
          'unfulfilled',
          'fulfilled'
        )
      )
      not valid;
  end if;
end $$;

create index if not exists orders_fulfillment_status_idx
on public.orders(workspace_id, fulfillment_status, created_at desc);

create index if not exists store_orders_fulfillment_status_idx
on public.store_orders(workspace_id, fulfillment_status, created_at desc);
