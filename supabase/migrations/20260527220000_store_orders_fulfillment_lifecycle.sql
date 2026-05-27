-- Store orders fulfillment lifecycle.
-- Additive only: keeps order status, payments, checkout, and existing rows intact.

alter table if exists public.store_orders
  add column if not exists preparing_at timestamptz,
  add column if not exists ready_for_pickup_at timestamptz,
  add column if not exists out_for_delivery_at timestamptz,
  add column if not exists fulfilled_at timestamptz,
  add column if not exists fulfillment_notes text;

alter table if exists public.store_orders
  add column if not exists fulfillment_status text not null default 'unfulfilled';

alter table if exists public.store_orders
  alter column fulfillment_status set default 'unfulfilled';

update public.store_orders
set fulfillment_status = 'unfulfilled'
where fulfillment_status is null
   or fulfillment_status = ''
   or fulfillment_status = 'pending';

do $$
begin
  if to_regclass('public.store_orders') is null then
    return;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'store_orders_fulfillment_status_check'
      and conrelid = 'public.store_orders'::regclass
  ) then
    alter table public.store_orders
      add constraint store_orders_fulfillment_status_check
      check (
        fulfillment_status in (
          'unfulfilled',
          'preparing',
          'ready_for_pickup',
          'out_for_delivery',
          'fulfilled'
        )
      )
      not valid;
  end if;
end $$;

create index if not exists store_orders_fulfillment_status_idx
on public.store_orders(workspace_id, fulfillment_status, created_at desc);

create index if not exists store_orders_fulfilled_at_idx
on public.store_orders(workspace_id, fulfilled_at desc);
