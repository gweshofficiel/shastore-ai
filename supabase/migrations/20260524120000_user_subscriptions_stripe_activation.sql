-- Stripe webhook subscription activation foundation.
-- Additive only: keeps existing plan gates, stores, storefronts, orders, and pricing checkout intact.

create extension if not exists "pgcrypto";

do $$
begin
  if not exists (select 1 from pg_type where typname = 'subscription_status') then
    create type public.subscription_status as enum (
      'trialing',
      'active',
      'past_due',
      'canceled',
      'incomplete'
    );
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
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists current_period_start timestamptz,
  add column if not exists current_period_end timestamptz,
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists user_subscriptions_user_id_unique_idx
  on public.user_subscriptions(user_id);

create index if not exists user_subscriptions_plan_id_idx
  on public.user_subscriptions(plan_id);

create index if not exists user_subscriptions_stripe_customer_idx
  on public.user_subscriptions(stripe_customer_id)
  where stripe_customer_id is not null;

create index if not exists user_subscriptions_stripe_subscription_idx
  on public.user_subscriptions(stripe_subscription_id)
  where stripe_subscription_id is not null;

alter table public.user_subscriptions enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_subscriptions'
      and policyname = 'Users read own subscription foundation'
  ) then
    create policy "Users read own subscription foundation"
      on public.user_subscriptions
      for select
      using (auth.uid() = user_id);
  end if;
end $$;

create or replace function public.set_user_subscriptions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'user_subscriptions_updated_at'
  ) then
    create trigger user_subscriptions_updated_at
      before update on public.user_subscriptions
      for each row execute function public.set_user_subscriptions_updated_at();
  end if;
end $$;
