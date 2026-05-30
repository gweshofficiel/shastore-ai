-- Subscription runtime enforcement foundation.
-- Additive only: preserves existing billing, stores, orders, and RLS.

create extension if not exists "pgcrypto";

do $$
begin
  if not exists (select 1 from pg_type where typname = 'subscription_status') then
    create type public.subscription_status as enum (
      'trialing',
      'active',
      'past_due',
      'canceled',
      'incomplete',
      'unpaid'
    );
  else
    alter type public.subscription_status add value if not exists 'unpaid';
  end if;
end $$;

create table if not exists public.user_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  plan_id text not null default 'free',
  status public.subscription_status not null default 'active',
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_subscriptions
  add column if not exists plan_id text not null default 'free',
  add column if not exists status public.subscription_status not null default 'active',
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists current_period_start timestamptz,
  add column if not exists current_period_end timestamptz,
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists plan_key text,
  add column if not exists limits_snapshot jsonb not null default '{}'::jsonb;

update public.user_subscriptions
set plan_key = coalesce(plan_key, plan_id)
where plan_key is null;

create unique index if not exists user_subscriptions_user_id_unique_idx
on public.user_subscriptions(user_id);

alter table public.user_subscriptions enable row level security;

drop policy if exists "Users read own subscription foundation" on public.user_subscriptions;
create policy "Users read own subscription foundation"
on public.user_subscriptions
for select
to authenticated
using (auth.uid() = user_id);

create table if not exists public.subscription_enforcement_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  store_id uuid,
  user_id uuid,
  action text not null,
  reason text not null,
  plan_key text,
  status text,
  created_at timestamptz not null default now()
);

create index if not exists subscription_enforcement_logs_workspace_created_idx
on public.subscription_enforcement_logs(workspace_id, created_at desc);

create index if not exists subscription_enforcement_logs_store_created_idx
on public.subscription_enforcement_logs(store_id, created_at desc)
where store_id is not null;

alter table public.subscription_enforcement_logs enable row level security;

drop policy if exists "workspace members read subscription enforcement logs" on public.subscription_enforcement_logs;
create policy "workspace members read subscription enforcement logs"
on public.subscription_enforcement_logs
for select
to authenticated
using (public.can_access_workspace(workspace_id));

drop policy if exists "service role can manage subscription enforcement logs" on public.subscription_enforcement_logs;
create policy "service role can manage subscription enforcement logs"
on public.subscription_enforcement_logs
for all
to service_role
using (true)
with check (true);
