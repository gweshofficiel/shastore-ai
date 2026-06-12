-- Stripe platform billing runtime support.
-- Additive only: does not reset data, weaken RLS, or touch store checkout/provider tables.

create extension if not exists "pgcrypto";

create table if not exists public.billing_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references auth.users(id) on delete set null,
  provider text not null default 'stripe',
  event_type text not null,
  provider_event_id text unique,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references auth.users(id) on delete set null,
  subscription_id uuid null references public.user_subscriptions(id) on delete set null,
  provider text not null default 'stripe',
  provider_invoice_id text unique,
  status text,
  amount_due integer not null default 0,
  amount_paid integer not null default 0,
  currency text not null default 'USD',
  invoice_url text,
  hosted_invoice_url text,
  issued_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.billing_events
  add column if not exists user_id uuid references auth.users(id) on delete set null,
  add column if not exists provider text not null default 'stripe',
  add column if not exists event_type text not null default 'unknown',
  add column if not exists provider_event_id text,
  add column if not exists payload jsonb not null default '{}'::jsonb,
  add column if not exists processed_at timestamptz not null default now(),
  add column if not exists created_at timestamptz not null default now();

alter table public.invoices
  add column if not exists user_id uuid references auth.users(id) on delete set null,
  add column if not exists subscription_id uuid references public.user_subscriptions(id) on delete set null,
  add column if not exists provider text not null default 'stripe',
  add column if not exists provider_invoice_id text,
  add column if not exists status text,
  add column if not exists amount_due integer not null default 0,
  add column if not exists amount_paid integer not null default 0,
  add column if not exists currency text not null default 'USD',
  add column if not exists invoice_url text,
  add column if not exists hosted_invoice_url text,
  add column if not exists issued_at timestamptz,
  add column if not exists paid_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists billing_events_provider_event_unique_idx
on public.billing_events(provider_event_id)
where provider_event_id is not null;

create index if not exists billing_events_user_processed_idx
on public.billing_events(user_id, processed_at desc);

create unique index if not exists invoices_provider_invoice_unique_idx
on public.invoices(provider_invoice_id)
where provider_invoice_id is not null;

create index if not exists invoices_user_issued_idx
on public.invoices(user_id, issued_at desc);

alter table public.billing_events enable row level security;
alter table public.invoices enable row level security;

drop policy if exists "Users read own billing events" on public.billing_events;
create policy "Users read own billing events"
on public.billing_events
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Service role manages billing events" on public.billing_events;
create policy "Service role manages billing events"
on public.billing_events
for all
to service_role
using (true)
with check (true);

drop policy if exists "Users read own invoices" on public.invoices;
create policy "Users read own invoices"
on public.invoices
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Service role manages invoices" on public.invoices;
create policy "Service role manages invoices"
on public.invoices
for all
to service_role
using (true)
with check (true);

grant select on public.billing_events to authenticated;
grant select on public.invoices to authenticated;
grant all on public.billing_events to service_role;
grant all on public.invoices to service_role;
