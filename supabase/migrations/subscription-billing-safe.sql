-- SHASTORE AI - User subscription and billing safe migration
-- Run in Supabase SQL Editor for existing databases.
-- Idempotent: does not drop data or modify admin/landing/store content tables.

create extension if not exists "pgcrypto";

do $$
begin
  create type subscription_status as enum ('trialing', 'active', 'past_due', 'canceled', 'incomplete');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.subscription_plans (
  id text primary key,
  name text not null,
  description text,
  price_cents integer not null default 0,
  currency text not null default 'USD',
  interval text not null default 'month',
  stripe_price_id text,
  store_limit integer,
  template_access text not null default 'limited',
  custom_branding_enabled boolean not null default false,
  publish_enabled boolean not null default false,
  seo_enabled boolean not null default false,
  custom_domain_enabled boolean not null default false,
  ai_features_enabled boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  plan_id text not null references public.subscription_plans(id),
  status subscription_status not null default 'active',
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_usage_limits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  plan_id text not null references public.subscription_plans(id),
  stores_used integer not null default 0,
  published_stores_used integer not null default 0,
  store_limit integer,
  updated_at timestamptz not null default now()
);

alter table public.subscription_plans enable row level security;
alter table public.user_subscriptions enable row level security;
alter table public.user_usage_limits enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'subscription_plans'
      and policyname = 'Subscription plans are readable'
  ) then
    create policy "Subscription plans are readable" on public.subscription_plans
      for select using (is_active = true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'user_subscriptions'
      and policyname = 'Users read own subscription foundation'
  ) then
    create policy "Users read own subscription foundation" on public.user_subscriptions
      for select using (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'user_usage_limits'
      and policyname = 'Users read own usage limits'
  ) then
    create policy "Users read own usage limits" on public.user_usage_limits
      for select using (auth.uid() = user_id);
  end if;
end $$;

create index if not exists user_subscriptions_user_id_idx on public.user_subscriptions(user_id);
create index if not exists user_subscriptions_plan_id_idx on public.user_subscriptions(plan_id);
create index if not exists user_usage_limits_user_id_idx on public.user_usage_limits(user_id);

insert into public.subscription_plans (
  id,
  name,
  description,
  price_cents,
  currency,
  interval,
  stripe_price_id,
  store_limit,
  template_access,
  custom_branding_enabled,
  publish_enabled,
  seo_enabled,
  custom_domain_enabled,
  ai_features_enabled,
  sort_order
)
values
  (
    'free',
    'Free',
    'Start with one store, limited templates, and SHASTORE branding.',
    0,
    'USD',
    'month',
    null,
    1,
    'limited',
    false,
    false,
    false,
    false,
    false,
    1
  ),
  (
    'pro',
    'Pro',
    'Grow with five stores, all templates, publishing, SEO, and custom branding.',
    2900,
    'USD',
    'month',
    nullif(current_setting('app.stripe_price_pro', true), ''),
    5,
    'all',
    true,
    true,
    true,
    false,
    false,
    2
  ),
  (
    'business',
    'Business',
    'Scale with unlimited stores, premium access, future domains, and future AI features.',
    7900,
    'USD',
    'month',
    nullif(current_setting('app.stripe_price_business', true), ''),
    null,
    'all',
    true,
    true,
    true,
    true,
    true,
    3
  )
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  price_cents = excluded.price_cents,
  currency = excluded.currency,
  interval = excluded.interval,
  store_limit = excluded.store_limit,
  template_access = excluded.template_access,
  custom_branding_enabled = excluded.custom_branding_enabled,
  publish_enabled = excluded.publish_enabled,
  seo_enabled = excluded.seo_enabled,
  custom_domain_enabled = excluded.custom_domain_enabled,
  ai_features_enabled = excluded.ai_features_enabled,
  sort_order = excluded.sort_order,
  updated_at = now();
