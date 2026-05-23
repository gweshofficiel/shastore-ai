-- SHASTORE AI - Production subscription and billing engine
-- Idempotent and billing-only. Does not modify commerce, publishing, domains, auth, stores, or analytics logic.

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
  publish_enabled boolean not null default true,
  seo_enabled boolean not null default false,
  custom_domain_enabled boolean not null default false,
  ai_features_enabled boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subscription_plans
  add column if not exists landing_limit integer,
  add column if not exists domain_limit integer,
  add column if not exists analytics_access text not null default 'limited',
  add column if not exists shastore_branding_enabled boolean not null default true,
  add column if not exists priority_rendering_enabled boolean not null default false,
  add column if not exists store_support_enabled boolean not null default false,
  add column if not exists team_features_enabled boolean not null default false,
  add column if not exists priority_support_enabled boolean not null default false,
  add column if not exists features jsonb not null default '[]'::jsonb;

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
  manual_override boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_subscriptions
  add column if not exists manual_override boolean not null default false;

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  provider text not null default 'stripe',
  provider_invoice_id text unique,
  subscription_id uuid references public.user_subscriptions(id) on delete set null,
  amount_due integer not null default 0,
  amount_paid integer not null default 0,
  currency text not null default 'USD',
  status text not null default 'draft',
  invoice_url text,
  hosted_invoice_url text,
  issued_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.billing_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  provider text not null default 'stripe',
  provider_event_id text unique,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.usage_tracking (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  period_start date not null default date_trunc('month', now())::date,
  period_end date not null default (date_trunc('month', now()) + interval '1 month - 1 day')::date,
  landing_pages_count integer not null default 0,
  stores_count integer not null default 0,
  orders_count integer not null default 0,
  traffic_events_count integer not null default 0,
  storage_mb numeric not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (user_id, period_start)
);

alter table public.subscription_plans enable row level security;
alter table public.user_subscriptions enable row level security;
alter table public.invoices enable row level security;
alter table public.billing_events enable row level security;
alter table public.usage_tracking enable row level security;

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
      and tablename = 'invoices'
      and policyname = 'Users read own invoices'
  ) then
    create policy "Users read own invoices" on public.invoices
      for select using (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'billing_events'
      and policyname = 'Users read own billing events'
  ) then
    create policy "Users read own billing events" on public.billing_events
      for select using (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'usage_tracking'
      and policyname = 'Users read own usage tracking'
  ) then
    create policy "Users read own usage tracking" on public.usage_tracking
      for select using (auth.uid() = user_id);
  end if;
end $$;

create index if not exists user_subscriptions_user_id_idx on public.user_subscriptions(user_id);
create index if not exists user_subscriptions_plan_id_idx on public.user_subscriptions(plan_id);
create index if not exists invoices_user_id_idx on public.invoices(user_id);
create index if not exists billing_events_user_id_idx on public.billing_events(user_id);
create index if not exists usage_tracking_user_period_idx on public.usage_tracking(user_id, period_start);

insert into public.subscription_plans (
  id,
  name,
  description,
  price_cents,
  currency,
  interval,
  stripe_price_id,
  landing_limit,
  store_limit,
  domain_limit,
  analytics_access,
  template_access,
  custom_branding_enabled,
  publish_enabled,
  seo_enabled,
  custom_domain_enabled,
  shastore_branding_enabled,
  priority_rendering_enabled,
  store_support_enabled,
  team_features_enabled,
  priority_support_enabled,
  features,
  sort_order
)
values
  ('free', 'Free', '1 landing page with SHASTORE branding and limited analytics.', 0, 'USD', 'month', null, 1, 0, 0, 'limited', 'limited', false, true, false, false, true, false, false, false, false, '["1 landing page","SHASTORE branding","Limited analytics"]'::jsonb, 1),
  ('starter', 'Starter', '10 landing pages, custom branding, basic analytics, and domains.', 1900, 'USD', 'month', nullif(current_setting('app.stripe_price_starter', true), ''), 10, 0, 1, 'basic', 'premium', true, true, true, true, false, false, false, false, false, '["10 landing pages","Custom branding","Basic analytics","Custom domains"]'::jsonb, 2),
  ('pro', 'Pro', 'Unlimited pages, advanced analytics, priority rendering, premium templates, and store support.', 4900, 'USD', 'month', nullif(current_setting('app.stripe_price_pro', true), ''), null, null, 5, 'advanced', 'all', true, true, true, true, false, true, true, false, true, '["Unlimited pages","Advanced analytics","Priority rendering","Premium templates","Store support"]'::jsonb, 3),
  ('agency', 'Agency', 'Multi-brand workspace with unlimited stores, domains, teams, and support.', 14900, 'USD', 'month', nullif(current_setting('app.stripe_price_agency', true), ''), null, null, null, 'advanced', 'all', true, true, true, true, false, true, true, true, true, '["Multi-brand workspace","Unlimited stores","Unlimited domains","Team features","Priority support"]'::jsonb, 4)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  price_cents = excluded.price_cents,
  currency = excluded.currency,
  interval = excluded.interval,
  stripe_price_id = excluded.stripe_price_id,
  landing_limit = excluded.landing_limit,
  store_limit = excluded.store_limit,
  domain_limit = excluded.domain_limit,
  analytics_access = excluded.analytics_access,
  template_access = excluded.template_access,
  custom_branding_enabled = excluded.custom_branding_enabled,
  publish_enabled = excluded.publish_enabled,
  seo_enabled = excluded.seo_enabled,
  custom_domain_enabled = excluded.custom_domain_enabled,
  shastore_branding_enabled = excluded.shastore_branding_enabled,
  priority_rendering_enabled = excluded.priority_rendering_enabled,
  store_support_enabled = excluded.store_support_enabled,
  team_features_enabled = excluded.team_features_enabled,
  priority_support_enabled = excluded.priority_support_enabled,
  features = excluded.features,
  sort_order = excluded.sort_order,
  updated_at = now();

update public.user_subscriptions
set plan_id = 'agency'
where plan_id = 'business'
  and exists (select 1 from public.subscription_plans where id = 'agency');

