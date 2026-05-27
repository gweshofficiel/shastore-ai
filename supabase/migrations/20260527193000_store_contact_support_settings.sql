-- Store public contact/support settings.
-- Additive only: preserves existing stores, publications, products, carts, and orders.

alter table if exists public.stores
  add column if not exists support_email text,
  add column if not exists support_phone text,
  add column if not exists business_address text,
  add column if not exists business_hours text;
