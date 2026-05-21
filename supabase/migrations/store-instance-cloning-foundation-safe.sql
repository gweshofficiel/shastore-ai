-- Real store instance cloning foundation for SHASTORE AI.
-- Additive only: upgrades reseller provisioning into persisted cloned store instances.
-- Does not touch Stripe billing, subscriptions, checkout, shipping, auth core,
-- template studio editor UI, reseller showcase rendering, public storefront
-- rendering, admin analytics, or the existing account ID system.

create table if not exists public.store_instances (
  id uuid primary key default gen_random_uuid(),
  internal_slug text not null unique,
  owner_user_id uuid,
  reseller_user_id uuid not null references auth.users(id) on delete cascade,
  purchase_request_id uuid not null unique references public.store_purchase_requests(id) on delete cascade,
  source_template_key text,
  source_template_id text,
  store_name text not null,
  status text not null default 'provisioning'
    check (status in ('provisioning', 'prepared', 'delivered', 'transferred', 'suspended')),
  visibility text not null default 'private'
    check (visibility in ('private', 'preview', 'public')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.store_instance_products (
  id uuid primary key default gen_random_uuid(),
  store_instance_id uuid not null references public.store_instances(id) on delete cascade,
  product_type text not null default 'physical',
  name text not null,
  category text,
  price_label text,
  short_description text,
  image_placeholder text,
  stock_placeholder text,
  featured boolean not null default false,
  product_data jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.store_instance_categories (
  id uuid primary key default gen_random_uuid(),
  store_instance_id uuid not null references public.store_instances(id) on delete cascade,
  name text not null,
  slug text not null,
  category_data jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (store_instance_id, slug)
);

create table if not exists public.store_instance_branding (
  id uuid primary key default gen_random_uuid(),
  store_instance_id uuid not null unique references public.store_instances(id) on delete cascade,
  logo text,
  banner text,
  primary_color text,
  secondary_color text,
  seo jsonb not null default '{}'::jsonb,
  footer_settings jsonb not null default '{}'::jsonb,
  contact_settings jsonb not null default '{}'::jsonb,
  cta jsonb not null default '{}'::jsonb,
  homepage_content jsonb not null default '{}'::jsonb,
  social_links jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.store_instance_domains (
  id uuid primary key default gen_random_uuid(),
  store_instance_id uuid not null unique references public.store_instances(id) on delete cascade,
  requested_domain text,
  connected_domain text,
  ssl_status text not null default 'not_configured'
    check (ssl_status in ('not_configured', 'pending', 'active', 'failed')),
  dns_status text not null default 'not_configured'
    check (dns_status in ('not_configured', 'pending', 'verified', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists store_instances_reseller_idx
  on public.store_instances(reseller_user_id, status, created_at desc);

create index if not exists store_instances_owner_idx
  on public.store_instances(owner_user_id, status, created_at desc);

create index if not exists store_instance_products_instance_idx
  on public.store_instance_products(store_instance_id, sort_order);

create index if not exists store_instance_categories_instance_idx
  on public.store_instance_categories(store_instance_id, sort_order);

alter table public.store_instances enable row level security;
alter table public.store_instance_products enable row level security;
alter table public.store_instance_categories enable row level security;
alter table public.store_instance_branding enable row level security;
alter table public.store_instance_domains enable row level security;

create or replace function public.resolve_shastore_user_account_id(candidate_account_id text)
returns table (
  lookup_status text,
  owner_user_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized text := upper(trim(coalesce(candidate_account_id, '')));
  found_user_id uuid;
  found_type text;
begin
  if normalized !~ '^SHA[0-9]{9}U$' then
    lookup_status := 'invalid_format';
    owner_user_id := null;
    return next;
    return;
  end if;

  select ap.user_id, ap.account_type
    into found_user_id, found_type
  from public.account_profiles ap
  where ap.account_id = normalized
  limit 1;

  if found_user_id is null then
    lookup_status := 'not_found';
    owner_user_id := null;
    return next;
    return;
  end if;

  if found_type <> 'user' then
    lookup_status := 'invalid_account_type';
    owner_user_id := null;
    return next;
    return;
  end if;

  lookup_status := 'exists';
  owner_user_id := found_user_id;
  return next;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'store_instances'
      and policyname = 'Owners and resellers view own store instances'
  ) then
    create policy "Owners and resellers view own store instances"
      on public.store_instances for select
      using (auth.uid() = owner_user_id or auth.uid() = reseller_user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'store_instances'
      and policyname = 'Resellers manage sold store instances'
  ) then
    create policy "Resellers manage sold store instances"
      on public.store_instances for all
      using (auth.uid() = reseller_user_id)
      with check (auth.uid() = reseller_user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'store_instances'
      and policyname = 'Admins read all store instances'
  ) then
    create policy "Admins read all store instances"
      on public.store_instances for select
      using (
        coalesce(auth.jwt() ->> 'role', '') = 'admin'
        or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
      );
  end if;
end $$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'store_instance_products',
    'store_instance_categories',
    'store_instance_branding',
    'store_instance_domains'
  ]
  loop
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = table_name
        and policyname = 'Owners and resellers view own cloned store records'
    ) then
      execute format(
        'create policy "Owners and resellers view own cloned store records" on public.%I for select using (
          exists (
            select 1 from public.store_instances instances
            where instances.id = %I.store_instance_id
              and (instances.owner_user_id = auth.uid() or instances.reseller_user_id = auth.uid())
          )
        )',
        table_name,
        table_name
      );
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = table_name
        and policyname = 'Resellers manage cloned store records'
    ) then
      execute format(
        'create policy "Resellers manage cloned store records" on public.%I for all using (
          exists (
            select 1 from public.store_instances instances
            where instances.id = %I.store_instance_id
              and instances.reseller_user_id = auth.uid()
          )
        ) with check (
          exists (
            select 1 from public.store_instances instances
            where instances.id = %I.store_instance_id
              and instances.reseller_user_id = auth.uid()
          )
        )',
        table_name,
        table_name,
        table_name
      );
    end if;
  end loop;
end $$;

create or replace function public.set_store_instances_updated_at()
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
  if not exists (select 1 from pg_trigger where tgname = 'store_instances_updated_at') then
    create trigger store_instances_updated_at
      before update on public.store_instances
      for each row execute function public.set_store_instances_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'store_instance_branding_updated_at') then
    create trigger store_instance_branding_updated_at
      before update on public.store_instance_branding
      for each row execute function public.set_store_instances_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'store_instance_domains_updated_at') then
    create trigger store_instance_domains_updated_at
      before update on public.store_instance_domains
      for each row execute function public.set_store_instances_updated_at();
  end if;
end $$;
