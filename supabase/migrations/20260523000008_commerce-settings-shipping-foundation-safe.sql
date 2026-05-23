-- Seller/reseller commerce operations and shipping foundation.
-- Additive only: does not touch platform billing, checkout, payment settings,
-- reseller showcase rendering, auth, orders creation, or public storefront rendering.

create table if not exists public.seller_commerce_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dashboard_scope text not null default 'seller' check (dashboard_scope in ('seller', 'reseller')),
  business_name text,
  business_email text,
  support_phone text,
  support_whatsapp text,
  business_address text,
  supported_countries jsonb not null default '[]'::jsonb,
  currency text not null default 'USD',
  timezone text not null default 'UTC',
  order_confirmation_mode text not null default 'manual' check (order_confirmation_mode in ('manual', 'whatsapp', 'email_placeholder', 'auto_placeholder')),
  return_policy text,
  shipping_policy text,
  privacy_policy text,
  taxes_enabled boolean not null default false,
  tax_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, dashboard_scope)
);

create table if not exists public.shipping_methods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dashboard_scope text not null default 'seller' check (dashboard_scope in ('seller', 'reseller')),
  method_name text not null,
  enabled boolean not null default true,
  flat_fee numeric(12,2) not null default 0,
  free_shipping_enabled boolean not null default false,
  shipping_regions jsonb not null default '[]'::jsonb,
  estimated_delivery_time text,
  local_delivery_enabled boolean not null default false,
  pickup_enabled boolean not null default false,
  cod_supported boolean not null default true,
  delivery_notes text,
  preparation_delay_days integer not null default 0,
  estimated_delivery_days integer not null default 3,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.delivery_agents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dashboard_scope text not null default 'seller' check (dashboard_scope in ('seller', 'reseller')),
  agent_name text not null,
  phone text,
  city text,
  vehicle_type text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists seller_commerce_settings_user_scope_idx
  on public.seller_commerce_settings(user_id, dashboard_scope);
create index if not exists shipping_methods_user_scope_idx
  on public.shipping_methods(user_id, dashboard_scope, enabled);
create index if not exists delivery_agents_user_scope_idx
  on public.delivery_agents(user_id, dashboard_scope, status);

alter table public.seller_commerce_settings enable row level security;
alter table public.shipping_methods enable row level security;
alter table public.delivery_agents enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'seller_commerce_settings'
      and policyname = 'Users manage own commerce operation settings'
  ) then
    create policy "Users manage own commerce operation settings"
      on public.seller_commerce_settings for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'shipping_methods'
      and policyname = 'Users manage own shipping methods'
  ) then
    create policy "Users manage own shipping methods"
      on public.shipping_methods for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'delivery_agents'
      and policyname = 'Users manage own delivery agents'
  ) then
    create policy "Users manage own delivery agents"
      on public.delivery_agents for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

create or replace function public.set_commerce_operations_updated_at()
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
  if not exists (select 1 from pg_trigger where tgname = 'seller_commerce_settings_updated_at') then
    create trigger seller_commerce_settings_updated_at
      before update on public.seller_commerce_settings
      for each row execute function public.set_commerce_operations_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'shipping_methods_updated_at') then
    create trigger shipping_methods_updated_at
      before update on public.shipping_methods
      for each row execute function public.set_commerce_operations_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'delivery_agents_updated_at') then
    create trigger delivery_agents_updated_at
      before update on public.delivery_agents
      for each row execute function public.set_commerce_operations_updated_at();
  end if;
end $$;

