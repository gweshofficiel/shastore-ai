create table if not exists public.subscription_plans (
  id text primary key,
  plan_id text unique,
  plan_name text,
  name text,
  monthly_price numeric(10, 2) not null default 0,
  yearly_price numeric(10, 2) not null default 0,
  price_cents integer not null default 0,
  active boolean not null default true,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  limits jsonb not null default '{}'::jsonb,
  stripe_price_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subscription_plans add column if not exists plan_id text;
alter table public.subscription_plans add column if not exists plan_name text;
alter table public.subscription_plans add column if not exists name text;
alter table public.subscription_plans add column if not exists monthly_price numeric(10, 2) not null default 0;
alter table public.subscription_plans add column if not exists yearly_price numeric(10, 2) not null default 0;
alter table public.subscription_plans add column if not exists price_cents integer not null default 0;
alter table public.subscription_plans add column if not exists active boolean not null default true;
alter table public.subscription_plans add column if not exists is_active boolean not null default true;
alter table public.subscription_plans add column if not exists sort_order integer not null default 0;
alter table public.subscription_plans add column if not exists limits jsonb not null default '{}'::jsonb;
alter table public.subscription_plans add column if not exists stripe_price_id text;
alter table public.subscription_plans add column if not exists created_at timestamptz not null default now();
alter table public.subscription_plans add column if not exists updated_at timestamptz not null default now();

update public.subscription_plans
set
  plan_id = coalesce(nullif(plan_id, ''), id),
  plan_name = coalesce(nullif(plan_name, ''), nullif(name, ''), initcap(replace(id, '_', ' '))),
  name = coalesce(nullif(name, ''), nullif(plan_name, ''), initcap(replace(id, '_', ' '))),
  monthly_price = case
    when monthly_price > 0 then monthly_price
    when price_cents > 0 then round((price_cents::numeric / 100), 2)
    else monthly_price
  end,
  yearly_price = case
    when yearly_price > 0 then yearly_price
    when price_cents > 0 then round((price_cents::numeric / 100) * 10, 2)
    else yearly_price
  end,
  price_cents = case
    when price_cents > 0 then price_cents
    else (monthly_price * 100)::integer
  end,
  active = coalesce(active, is_active, true),
  is_active = coalesce(is_active, active, true),
  updated_at = now();

insert into public.subscription_plans (
  id,
  plan_id,
  plan_name,
  name,
  monthly_price,
  yearly_price,
  price_cents,
  active,
  is_active,
  sort_order,
  limits,
  updated_at
)
values
  (
    'free',
    'free',
    'Free',
    'Free',
    0,
    0,
    0,
    true,
    true,
    0,
    '{"landingLimit":1,"storeLimit":1,"domainLimit":0,"analytics":"limited","templateAccess":"limited"}'::jsonb,
    now()
  ),
  (
    'starter',
    'starter',
    'Starter',
    'Starter',
    1,
    10,
    100,
    true,
    true,
    10,
    '{"landingLimit":10,"storeLimit":1,"domainLimit":1,"analytics":"basic","templateAccess":"premium"}'::jsonb,
    now()
  ),
  (
    'pro',
    'pro',
    'Pro',
    'Pro',
    49,
    490,
    4900,
    true,
    true,
    20,
    '{"landingLimit":10,"storeLimit":5,"domainLimit":5,"analytics":"advanced","templateAccess":"all"}'::jsonb,
    now()
  ),
  (
    'agency',
    'agency',
    'Agency',
    'Agency',
    149,
    1490,
    14900,
    true,
    true,
    30,
    '{"landingLimit":null,"storeLimit":null,"domainLimit":null,"analytics":"advanced","templateAccess":"all"}'::jsonb,
    now()
  )
on conflict (id) do update
set
  plan_id = excluded.plan_id,
  plan_name = excluded.plan_name,
  name = excluded.name,
  monthly_price = excluded.monthly_price,
  yearly_price = excluded.yearly_price,
  price_cents = excluded.price_cents,
  active = excluded.active,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order,
  limits = excluded.limits,
  updated_at = now();

create unique index if not exists subscription_plans_plan_id_key
  on public.subscription_plans (plan_id);

create index if not exists subscription_plans_active_sort_order_idx
  on public.subscription_plans (active, sort_order);

alter table public.subscription_plans enable row level security;

drop policy if exists "Authenticated users can read subscription plans" on public.subscription_plans;
create policy "Authenticated users can read subscription plans"
  on public.subscription_plans
  for select
  to authenticated
  using (true);

drop policy if exists "Service role can manage subscription plans" on public.subscription_plans;
create policy "Service role can manage subscription plans"
  on public.subscription_plans
  for all
  to service_role
  using (true)
  with check (true);
