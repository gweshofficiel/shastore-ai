alter table if exists public.store_payment_provider_connections
  add column if not exists connection_mode text not null default 'connect'
    check (connection_mode in ('connect', 'manual')),
  add column if not exists config_status text not null default 'not_configured'
    check (config_status in ('not_configured', 'configured', 'invalid')),
  add column if not exists environment text
    check (environment is null or environment in ('sandbox', 'test', 'live')),
  add column if not exists publishable_key text,
  add column if not exists public_key text,
  add column if not exists account_reference text,
  add column if not exists encrypted_config jsonb not null default '{}'::jsonb;

alter table if exists public.store_payment_provider_connections
  drop constraint if exists store_payment_provider_connections_provider_check;

alter table if exists public.store_payment_provider_connections
  add constraint store_payment_provider_connections_provider_check
  check (provider in ('stripe', 'paypal', 'youcan_pay'));

create index if not exists store_payment_provider_connections_status_idx
on public.store_payment_provider_connections(store_id, provider, connection_status, config_status);
