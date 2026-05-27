-- Manual order confirmation flow foundation.
-- Additive only: prepares lifecycle fields without activating payment processors.

alter table if exists public.orders
  add column if not exists payment_method text not null default 'manual',
  add column if not exists payment_status text not null default 'pending',
  add column if not exists confirmed_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists internal_note text,
  add column if not exists updated_at timestamptz not null default now();

alter table if exists public.store_orders
  add column if not exists payment_method text not null default 'manual',
  add column if not exists payment_status text not null default 'pending',
  add column if not exists confirmed_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists internal_note text,
  add column if not exists updated_at timestamptz not null default now();

update public.orders
set
  payment_method = coalesce(nullif(payment_method, ''), 'manual'),
  payment_status = coalesce(nullif(payment_status, ''), 'pending')
where payment_method is null
   or payment_method = ''
   or payment_status is null
   or payment_status = '';

update public.store_orders
set
  payment_method = coalesce(nullif(payment_method, ''), 'manual'),
  payment_status = coalesce(nullif(payment_status, ''), 'pending')
where payment_method is null
   or payment_method = ''
   or payment_status is null
   or payment_status = '';

create index if not exists orders_manual_lifecycle_idx
on public.orders(workspace_id, order_status, confirmed_at desc, cancelled_at desc);

create index if not exists store_orders_manual_lifecycle_idx
on public.store_orders(workspace_id, order_status, confirmed_at desc, cancelled_at desc);
