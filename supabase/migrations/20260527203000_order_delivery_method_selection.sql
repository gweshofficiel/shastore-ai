-- Order delivery method selection foundation.
-- Additive only: preserves existing checkout, orders, tracking, and seller dashboards.

alter table if exists public.orders
  add column if not exists delivery_method text,
  add column if not exists delivery_fee numeric(12, 2) not null default 0;

alter table if exists public.store_orders
  add column if not exists delivery_method text,
  add column if not exists delivery_fee numeric(12, 2) not null default 0;
