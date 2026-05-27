-- Store public legal page settings.
-- Additive only: preserves existing stores, publications, products, carts, and orders.

alter table if exists public.stores
  add column if not exists privacy_policy text,
  add column if not exists terms_of_service text,
  add column if not exists refund_policy text;
