-- Multi-currency storefront foundation.
-- Additive only: manual rates and selected-currency storage without changing payment logic.

alter table if exists public.stores
  add column if not exists currency_settings jsonb not null default '{}'::jsonb;

alter table if exists public.orders
  add column if not exists base_currency text,
  add column if not exists exchange_rate numeric(18, 8) not null default 1,
  add column if not exists currency_settings_snapshot jsonb not null default '{}'::jsonb;

alter table if exists public.store_orders
  add column if not exists currency text not null default 'USD',
  add column if not exists base_currency text,
  add column if not exists exchange_rate numeric(18, 8) not null default 1,
  add column if not exists currency_settings_snapshot jsonb not null default '{}'::jsonb;

alter table if exists public.order_items
  add column if not exists base_currency text,
  add column if not exists exchange_rate numeric(18, 8) not null default 1;

create index if not exists stores_currency_settings_idx
on public.stores using gin (currency_settings);

create index if not exists orders_currency_idx
on public.orders(store_id, currency, created_at desc);

create index if not exists store_orders_currency_idx
on public.store_orders(store_id, currency, created_at desc);
