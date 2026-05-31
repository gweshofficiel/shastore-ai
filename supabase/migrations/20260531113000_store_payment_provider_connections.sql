create table if not exists public.store_payment_provider_connections (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  workspace_id uuid not null,
  provider text not null check (provider in ('stripe', 'paypal')),
  connection_status text not null default 'not_connected'
    check (connection_status in ('not_connected', 'pending', 'connected', 'restricted', 'disconnected')),
  stripe_account_id text,
  onboarding_completed_at timestamptz,
  charges_enabled boolean not null default false,
  payouts_enabled boolean not null default false,
  paypal_merchant_id text,
  paypal_status text,
  connected_at timestamptz,
  disconnected_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, provider)
);

create index if not exists store_payment_provider_connections_store_idx
on public.store_payment_provider_connections(store_id, provider);

create index if not exists store_payment_provider_connections_workspace_idx
on public.store_payment_provider_connections(workspace_id, store_id);

alter table public.store_payment_provider_connections enable row level security;

drop policy if exists "workspace members read own store payment provider connections" on public.store_payment_provider_connections;
drop policy if exists "workspace editors manage own store payment provider connections" on public.store_payment_provider_connections;
drop policy if exists "service role manages store payment provider connections" on public.store_payment_provider_connections;

create policy "workspace members read own store payment provider connections"
on public.store_payment_provider_connections
for select
to authenticated
using (public.can_access_workspace(workspace_id));

create policy "workspace editors manage own store payment provider connections"
on public.store_payment_provider_connections
for all
to authenticated
using (public.workspace_can_edit(workspace_id))
with check (public.workspace_can_edit(workspace_id));

create policy "service role manages store payment provider connections"
on public.store_payment_provider_connections
for all
to service_role
using (true)
with check (true);

grant select, insert, update, delete on public.store_payment_provider_connections to authenticated;
grant all on public.store_payment_provider_connections to service_role;
