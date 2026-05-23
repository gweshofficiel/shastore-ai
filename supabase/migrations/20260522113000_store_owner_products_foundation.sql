-- Store owner products foundation.
-- Additive only: extends store_instance_products for claimed buyer/store owners.

create extension if not exists "pgcrypto";

create table if not exists public.store_instance_products (
  id uuid primary key default gen_random_uuid(),
  store_instance_id uuid not null references public.store_instances(id) on delete cascade,
  product_type text not null default 'physical',
  name text,
  category text,
  price_label text,
  image_placeholder text,
  stock_placeholder text,
  featured boolean not null default false,
  product_data jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  title text,
  slug text,
  short_description text,
  status text not null default 'draft'
    check (status in ('draft', 'published')),
  price numeric(12, 2) not null default 0
    check (price >= 0),
  compare_at_price numeric(12, 2)
    check (compare_at_price is null or compare_at_price >= 0),
  sku text,
  inventory_quantity integer not null default 0
    check (inventory_quantity >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.store_instance_products
  add column if not exists product_type text not null default 'physical',
  add column if not exists name text,
  add column if not exists category text,
  add column if not exists price_label text,
  add column if not exists image_placeholder text,
  add column if not exists stock_placeholder text,
  add column if not exists featured boolean not null default false,
  add column if not exists product_data jsonb not null default '{}'::jsonb,
  add column if not exists sort_order integer not null default 0,
  add column if not exists title text,
  add column if not exists slug text,
  add column if not exists short_description text,
  add column if not exists status text not null default 'draft',
  add column if not exists price numeric(12, 2) not null default 0,
  add column if not exists compare_at_price numeric(12, 2),
  add column if not exists sku text,
  add column if not exists inventory_quantity integer not null default 0,
  add column if not exists updated_at timestamptz not null default now();

update public.store_instance_products
set title = coalesce(nullif(trim(title), ''), nullif(trim(name), ''), 'Untitled product')
where title is null or trim(title) = '';

update public.store_instance_products
set slug = lower(
  regexp_replace(
    regexp_replace(coalesce(nullif(trim(slug), ''), nullif(trim(title), ''), 'product'), '[^a-zA-Z0-9]+', '-', 'g'),
    '(^-|-$)',
    '',
    'g'
  )
) || '-' || left(replace(id::text, '-', ''), 8)
where slug is null or trim(slug) = '';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'store_instance_products_status_check'
      and conrelid = 'public.store_instance_products'::regclass
  ) then
    alter table public.store_instance_products
      add constraint store_instance_products_status_check
      check (status in ('draft', 'published'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'store_instance_products_price_check'
      and conrelid = 'public.store_instance_products'::regclass
  ) then
    alter table public.store_instance_products
      add constraint store_instance_products_price_check
      check (price >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'store_instance_products_compare_at_price_check'
      and conrelid = 'public.store_instance_products'::regclass
  ) then
    alter table public.store_instance_products
      add constraint store_instance_products_compare_at_price_check
      check (compare_at_price is null or compare_at_price >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'store_instance_products_inventory_quantity_check'
      and conrelid = 'public.store_instance_products'::regclass
  ) then
    alter table public.store_instance_products
      add constraint store_instance_products_inventory_quantity_check
      check (inventory_quantity >= 0);
  end if;
end $$;

create unique index if not exists store_instance_products_instance_slug_idx
  on public.store_instance_products(store_instance_id, slug);

create index if not exists store_instance_products_owner_dashboard_idx
  on public.store_instance_products(store_instance_id, status, updated_at desc);

alter table public.store_instance_products enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'store_instance_products'
      and policyname = 'Buyer store managers write products'
  ) then
    create policy "Buyer store managers write products"
      on public.store_instance_products for all
      using (public.can_manage_store_instance(store_instance_id))
      with check (public.can_manage_store_instance(store_instance_id));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'store_instance_products'
      and policyname = 'Buyer store members read products'
  ) then
    create policy "Buyer store members read products"
      on public.store_instance_products for select
      using (public.can_access_store_instance(store_instance_id));
  end if;
end $$;

create or replace function public.set_store_instance_products_updated_at()
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
  if not exists (select 1 from pg_trigger where tgname = 'store_instance_products_updated_at') then
    create trigger store_instance_products_updated_at
      before update on public.store_instance_products
      for each row execute function public.set_store_instance_products_updated_at();
  end if;
end $$;

