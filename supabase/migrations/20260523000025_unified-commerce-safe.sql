-- Unified commerce foundation for SHASTORE AI.
-- Safe for existing databases: only creates missing tables, indexes, policies, and triggers.

create table if not exists public.commerce_customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_type text not null default 'manual' check (source_type in ('landing', 'store', 'manual')),
  source_id uuid,
  name text not null,
  email text,
  phone text,
  city text,
  country text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.commerce_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid references public.commerce_customers(id) on delete set null,
  source_type text not null check (source_type in ('landing', 'store')),
  source_id uuid,
  source_slug text,
  status text not null default 'new' check (status in ('new', 'confirmed', 'shipped', 'delivered', 'canceled')),
  payment_method text not null default 'whatsapp' check (payment_method in ('cod', 'whatsapp', 'stripe', 'paypal')),
  payment_status text not null default 'pending' check (payment_status in ('pending', 'paid', 'failed', 'refunded')),
  customer_snapshot jsonb not null default '{}'::jsonb,
  products jsonb not null default '[]'::jsonb,
  currency text not null default 'USD',
  total_amount numeric(12,2) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.commerce_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.commerce_orders(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id text,
  product_name text not null,
  quantity integer not null default 1 check (quantity > 0),
  unit_price numeric(12,2) not null default 0,
  total_price numeric(12,2) not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.commerce_analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  source_type text not null check (source_type in ('landing', 'store')),
  source_id uuid,
  source_slug text,
  event_type text not null check (event_type in ('visitor', 'page_view', 'whatsapp_click', 'conversion', 'order')),
  visitor_id text,
  session_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.commerce_payment_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  stripe_enabled boolean not null default false,
  paypal_enabled boolean not null default false,
  cod_enabled boolean not null default true,
  whatsapp_orders_enabled boolean not null default true,
  default_whatsapp_number text,
  stripe_seller_enabled boolean not null default false,
  paypal_seller_enabled boolean not null default false,
  crypto_enabled boolean not null default false,
  payment_instructions text,
  stripe_account_label text,
  paypal_account_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.commerce_payment_settings
  add column if not exists default_whatsapp_number text,
  add column if not exists stripe_seller_enabled boolean not null default false,
  add column if not exists paypal_seller_enabled boolean not null default false,
  add column if not exists crypto_enabled boolean not null default false,
  add column if not exists payment_instructions text;

create table if not exists public.commerce_domain_publications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_type text not null check (source_type in ('landing', 'store')),
  source_id uuid,
  source_slug text,
  free_subdomain text,
  custom_domain text,
  hostname text,
  status text not null default 'pending' check (status in ('pending', 'verified', 'failed')),
  verification_token text not null default md5(random()::text || clock_timestamp()::text),
  dns_target text not null default 'cname.vercel-dns.com',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists commerce_customers_user_idx on public.commerce_customers(user_id, created_at desc);
create index if not exists commerce_customers_source_idx on public.commerce_customers(user_id, source_type, source_id);
create index if not exists commerce_orders_user_idx on public.commerce_orders(user_id, created_at desc);
create index if not exists commerce_orders_status_idx on public.commerce_orders(user_id, status);
create index if not exists commerce_orders_source_idx on public.commerce_orders(user_id, source_type, source_id);
create index if not exists commerce_order_items_order_idx on public.commerce_order_items(order_id);
create index if not exists commerce_events_user_type_idx on public.commerce_analytics_events(user_id, event_type, created_at desc);
create index if not exists commerce_events_source_idx on public.commerce_analytics_events(source_type, source_id, created_at desc);
create index if not exists commerce_domain_publications_user_idx on public.commerce_domain_publications(user_id, source_type, source_id);

alter table public.commerce_customers enable row level security;
alter table public.commerce_orders enable row level security;
alter table public.commerce_order_items enable row level security;
alter table public.commerce_analytics_events enable row level security;
alter table public.commerce_payment_settings enable row level security;
alter table public.commerce_domain_publications enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'commerce_customers' and policyname = 'Users manage own commerce customers'
  ) then
    create policy "Users manage own commerce customers"
      on public.commerce_customers for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'commerce_orders' and policyname = 'Users manage own commerce orders'
  ) then
    create policy "Users manage own commerce orders"
      on public.commerce_orders for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'commerce_order_items' and policyname = 'Users manage own commerce order items'
  ) then
    create policy "Users manage own commerce order items"
      on public.commerce_order_items for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'commerce_analytics_events' and policyname = 'Users read own commerce analytics'
  ) then
    create policy "Users read own commerce analytics"
      on public.commerce_analytics_events for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'commerce_analytics_events' and policyname = 'Users insert own commerce analytics'
  ) then
    create policy "Users insert own commerce analytics"
      on public.commerce_analytics_events for insert
      with check (auth.uid() = user_id or user_id is null);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'commerce_payment_settings' and policyname = 'Users manage own commerce payment settings'
  ) then
    create policy "Users manage own commerce payment settings"
      on public.commerce_payment_settings for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'commerce_domain_publications' and policyname = 'Users manage own commerce domain publications'
  ) then
    create policy "Users manage own commerce domain publications"
      on public.commerce_domain_publications for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

create or replace function public.set_commerce_updated_at()
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
  if not exists (select 1 from pg_trigger where tgname = 'commerce_customers_updated_at') then
    create trigger commerce_customers_updated_at
      before update on public.commerce_customers
      for each row execute function public.set_commerce_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'commerce_orders_updated_at') then
    create trigger commerce_orders_updated_at
      before update on public.commerce_orders
      for each row execute function public.set_commerce_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'commerce_payment_settings_updated_at') then
    create trigger commerce_payment_settings_updated_at
      before update on public.commerce_payment_settings
      for each row execute function public.set_commerce_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'commerce_domain_publications_updated_at') then
    create trigger commerce_domain_publications_updated_at
      before update on public.commerce_domain_publications
      for each row execute function public.set_commerce_updated_at();
  end if;
end $$;

