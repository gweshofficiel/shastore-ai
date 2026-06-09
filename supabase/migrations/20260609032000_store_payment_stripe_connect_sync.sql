-- Stripe Connect sync metadata for store-owned payments.
-- Additive only: does not change platform billing, checkout, orders, or RLS.

alter table if exists public.store_payment_provider_connections
  add column if not exists last_sync_at timestamptz;

create index if not exists store_payment_provider_connections_last_sync_idx
on public.store_payment_provider_connections(store_id, provider, last_sync_at desc);
