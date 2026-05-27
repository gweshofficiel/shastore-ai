-- Seller order fulfillment status foundation.
-- Additive only: keeps order status, payments, delivery method selection, and checkout totals stable.

alter table if exists public.orders
  add column if not exists fulfillment_status text not null default 'unfulfilled';

alter table if exists public.orders
  alter column fulfillment_status set default 'unfulfilled';

update public.orders
set fulfillment_status = 'unfulfilled'
where fulfillment_status is null
   or fulfillment_status = ''
   or fulfillment_status = 'pending';

alter table if exists public.store_orders
  add column if not exists fulfillment_status text not null default 'unfulfilled';

alter table if exists public.store_orders
  alter column fulfillment_status set default 'unfulfilled';

update public.store_orders
set fulfillment_status = 'unfulfilled'
where fulfillment_status is null
   or fulfillment_status = ''
   or fulfillment_status = 'pending';

create index if not exists orders_fulfillment_status_idx
on public.orders(workspace_id, fulfillment_status, created_at desc);

create index if not exists store_orders_fulfillment_status_idx
on public.store_orders(workspace_id, fulfillment_status, created_at desc);
