-- Store public delivery/shipping settings foundation.
-- Additive only: preserves existing stores, products, carts, checkout, orders, and legal pages.

alter table if exists public.stores
  add column if not exists delivery_enabled boolean not null default false,
  add column if not exists pickup_enabled boolean not null default false,
  add column if not exists delivery_fee numeric(12, 2),
  add column if not exists free_delivery_threshold numeric(12, 2),
  add column if not exists delivery_notes text;
