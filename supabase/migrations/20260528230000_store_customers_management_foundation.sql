-- Store customer management foundation.
-- Additive only: mirrors existing order-derived customers into store_customers and adds
-- addresses/notes for dashboard customer management.

create extension if not exists "pgcrypto";

create table if not exists public.store_customers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null default 'Customer',
  email text,
  phone text,
  normalized_email text,
  normalized_phone text,
  status text not null default 'new',
  tags text[] not null default '{}'::text[],
  total_orders integer not null default 0,
  total_spent numeric(12, 2) not null default 0,
  first_order_at timestamptz,
  last_order_at timestamptz,
  last_order_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.store_customers
  add column if not exists workspace_id uuid,
  add column if not exists store_id uuid references public.stores(id) on delete cascade,
  add column if not exists name text not null default 'Customer',
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists normalized_email text,
  add column if not exists normalized_phone text,
  add column if not exists status text not null default 'new',
  add column if not exists tags text[] not null default '{}'::text[],
  add column if not exists total_orders integer not null default 0,
  add column if not exists total_spent numeric(12, 2) not null default 0,
  add column if not exists first_order_at timestamptz,
  add column if not exists last_order_at timestamptz,
  add column if not exists last_order_id uuid,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update public.store_customers
set
  normalized_email = nullif(lower(trim(coalesce(email, ''))), ''),
  normalized_phone = nullif(regexp_replace(coalesce(phone, ''), '[^0-9+]', '', 'g'), ''),
  tags = coalesce(tags, '{}'::text[]),
  status = case
    when status in ('new', 'active', 'returning', 'vip') then status
    when total_spent >= 1000 or total_orders >= 10 then 'vip'
    when total_orders >= 2 then 'returning'
    when total_orders = 1 then 'new'
    else 'active'
  end;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'store_customers_status_check'
      and conrelid = 'public.store_customers'::regclass
  ) then
    alter table public.store_customers
      add constraint store_customers_status_check
      check (status in ('new', 'active', 'returning', 'vip'));
  end if;
end $$;

create unique index if not exists store_customers_store_phone_unique_idx
on public.store_customers(workspace_id, store_id, normalized_phone)
where normalized_phone is not null;

create unique index if not exists store_customers_store_email_unique_idx
on public.store_customers(workspace_id, store_id, normalized_email)
where normalized_email is not null;

create index if not exists store_customers_workspace_store_idx
on public.store_customers(workspace_id, store_id, updated_at desc);

create index if not exists store_customers_last_order_idx
on public.store_customers(workspace_id, store_id, last_order_at desc);

create table if not exists public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.store_customers(id) on delete cascade,
  workspace_id uuid not null,
  store_id uuid not null references public.stores(id) on delete cascade,
  full_name text,
  phone text,
  address_line1 text not null,
  address_line2 text,
  city text,
  region text,
  country text,
  postal_code text,
  is_default boolean not null default false,
  order_id uuid,
  order_source text check (order_source in ('orders', 'store_orders')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists customer_addresses_customer_idx
on public.customer_addresses(customer_id, created_at desc);

create index if not exists customer_addresses_workspace_store_idx
on public.customer_addresses(workspace_id, store_id, created_at desc);

create unique index if not exists customer_addresses_order_unique_idx
on public.customer_addresses(customer_id, order_source, order_id)
where order_id is not null;

create table if not exists public.customer_notes (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.store_customers(id) on delete cascade,
  workspace_id uuid not null,
  store_id uuid not null references public.stores(id) on delete cascade,
  author_user_id uuid references auth.users(id) on delete set null,
  note text not null,
  tags text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists customer_notes_customer_idx
on public.customer_notes(customer_id, created_at desc);

create index if not exists customer_notes_workspace_store_idx
on public.customer_notes(workspace_id, store_id, created_at desc);

create or replace function public.derive_store_customer_status(
  candidate_total_orders integer,
  candidate_total_spent numeric
)
returns text
language sql
immutable
as $$
  select case
    when coalesce(candidate_total_spent, 0) >= 1000 or coalesce(candidate_total_orders, 0) >= 10 then 'vip'
    when coalesce(candidate_total_orders, 0) >= 2 then 'returning'
    when coalesce(candidate_total_orders, 0) = 1 then 'new'
    else 'active'
  end
$$;

create or replace function public.set_store_customers_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.normalized_phone = nullif(regexp_replace(coalesce(new.phone, ''), '[^0-9+]', '', 'g'), '');
  new.normalized_email = nullif(lower(trim(coalesce(new.email, ''))), '');
  new.tags = coalesce(new.tags, '{}'::text[]);
  new.status = case
    when new.status in ('new', 'active', 'returning', 'vip') then new.status
    else public.derive_store_customer_status(new.total_orders, new.total_spent)
  end;
  return new;
end;
$$;

drop trigger if exists store_customers_updated_at on public.store_customers;
create trigger store_customers_updated_at
before insert or update on public.store_customers
for each row execute function public.set_store_customers_updated_at();

create or replace function public.set_customer_addresses_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists customer_addresses_updated_at on public.customer_addresses;
create trigger customer_addresses_updated_at
before insert or update on public.customer_addresses
for each row execute function public.set_customer_addresses_updated_at();

create or replace function public.set_customer_notes_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.tags = coalesce(new.tags, '{}'::text[]);
  return new;
end;
$$;

drop trigger if exists customer_notes_updated_at on public.customer_notes;
create trigger customer_notes_updated_at
before insert or update on public.customer_notes
for each row execute function public.set_customer_notes_updated_at();

insert into public.store_customers (
  id,
  workspace_id,
  store_id,
  name,
  email,
  phone,
  normalized_email,
  normalized_phone,
  status,
  total_orders,
  total_spent,
  first_order_at,
  last_order_at,
  last_order_id,
  metadata,
  created_at,
  updated_at
)
select
  customers.id,
  customers.workspace_id,
  customers.store_id,
  coalesce(nullif(customers.name, ''), 'Customer'),
  customers.email,
  customers.phone,
  customers.normalized_email,
  customers.normalized_phone,
  public.derive_store_customer_status(customers.total_orders, customers.total_spent),
  coalesce(customers.total_orders, 0),
  coalesce(customers.total_spent, 0),
  customers.first_order_at,
  customers.last_order_at,
  customers.last_order_id,
  coalesce(customers.metadata, '{}'::jsonb) || jsonb_build_object('legacyCustomerId', customers.id),
  customers.created_at,
  customers.updated_at
from public.customers customers
where customers.workspace_id is not null
  and customers.store_id is not null
on conflict (id) do update
set
  workspace_id = excluded.workspace_id,
  store_id = excluded.store_id,
  name = excluded.name,
  email = excluded.email,
  phone = excluded.phone,
  normalized_email = excluded.normalized_email,
  normalized_phone = excluded.normalized_phone,
  status = case
    when public.store_customers.status in ('vip', 'active') then public.store_customers.status
    else excluded.status
  end,
  total_orders = excluded.total_orders,
  total_spent = excluded.total_spent,
  first_order_at = excluded.first_order_at,
  last_order_at = excluded.last_order_at,
  last_order_id = excluded.last_order_id,
  metadata = coalesce(public.store_customers.metadata, '{}'::jsonb) || excluded.metadata,
  updated_at = now();

create or replace function public.sync_store_customer_profile_from_customer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.workspace_id is null or new.store_id is null then
    return new;
  end if;

  insert into public.store_customers (
    id,
    workspace_id,
    store_id,
    name,
    email,
    phone,
    normalized_email,
    normalized_phone,
    status,
    total_orders,
    total_spent,
    first_order_at,
    last_order_at,
    last_order_id,
    metadata,
    created_at,
    updated_at
  )
  values (
    new.id,
    new.workspace_id,
    new.store_id,
    coalesce(nullif(new.name, ''), 'Customer'),
    new.email,
    new.phone,
    new.normalized_email,
    new.normalized_phone,
    public.derive_store_customer_status(new.total_orders, new.total_spent),
    coalesce(new.total_orders, 0),
    coalesce(new.total_spent, 0),
    new.first_order_at,
    new.last_order_at,
    new.last_order_id,
    coalesce(new.metadata, '{}'::jsonb) || jsonb_build_object('legacyCustomerId', new.id),
    coalesce(new.created_at, now()),
    coalesce(new.updated_at, now())
  )
  on conflict (id) do update
  set
    workspace_id = excluded.workspace_id,
    store_id = excluded.store_id,
    name = excluded.name,
    email = excluded.email,
    phone = excluded.phone,
    normalized_email = excluded.normalized_email,
    normalized_phone = excluded.normalized_phone,
    status = case
      when public.store_customers.status in ('vip', 'active') then public.store_customers.status
      else excluded.status
    end,
    total_orders = excluded.total_orders,
    total_spent = excluded.total_spent,
    first_order_at = excluded.first_order_at,
    last_order_at = excluded.last_order_at,
    last_order_id = excluded.last_order_id,
    metadata = coalesce(public.store_customers.metadata, '{}'::jsonb) || excluded.metadata,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists customers_store_customer_profile_sync on public.customers;
create trigger customers_store_customer_profile_sync
after insert or update on public.customers
for each row execute function public.sync_store_customer_profile_from_customer();

insert into public.customer_addresses (
  customer_id,
  workspace_id,
  store_id,
  full_name,
  phone,
  address_line1,
  order_id,
  order_source,
  metadata,
  created_at,
  updated_at
)
select distinct on (store_customers.id, orders.id)
  store_customers.id,
  store_customers.workspace_id,
  store_customers.store_id,
  orders.customer_name,
  orders.customer_phone,
  orders.customer_address,
  orders.id,
  'store_orders',
  jsonb_build_object('source', 'store_order'),
  orders.created_at,
  orders.created_at
from public.store_orders orders
join public.store_customers store_customers
  on store_customers.workspace_id = orders.workspace_id
  and store_customers.store_id = orders.store_id
  and (
    (store_customers.normalized_phone is not null and store_customers.normalized_phone = nullif(regexp_replace(coalesce(orders.customer_phone, ''), '[^0-9+]', '', 'g'), ''))
    or (store_customers.normalized_email is not null and store_customers.normalized_email = nullif(lower(trim(coalesce(orders.customer_email, ''))), ''))
  )
where orders.customer_address is not null
  and trim(orders.customer_address) <> ''
on conflict do nothing;

insert into public.customer_addresses (
  customer_id,
  workspace_id,
  store_id,
  full_name,
  phone,
  address_line1,
  order_id,
  order_source,
  metadata,
  created_at,
  updated_at
)
select distinct on (store_customers.id, orders.id)
  store_customers.id,
  store_customers.workspace_id,
  store_customers.store_id,
  orders.customer_name,
  orders.customer_phone,
  orders.customer_address,
  orders.id,
  'orders',
  jsonb_build_object('source', 'order'),
  orders.created_at,
  orders.created_at
from public.orders orders
join public.store_customers store_customers
  on store_customers.workspace_id = orders.workspace_id
  and store_customers.store_id = coalesce(orders.store_id, orders.store_instance_id)
  and (
    (store_customers.normalized_phone is not null and store_customers.normalized_phone = nullif(regexp_replace(coalesce(orders.customer_phone, ''), '[^0-9+]', '', 'g'), ''))
    or (store_customers.normalized_email is not null and store_customers.normalized_email = nullif(lower(trim(coalesce(orders.customer_email, ''))), ''))
  )
where orders.customer_address is not null
  and trim(orders.customer_address) <> ''
on conflict do nothing;

alter table public.store_customers enable row level security;
alter table public.customer_addresses enable row level security;
alter table public.customer_notes enable row level security;

drop policy if exists "workspace members read store customers" on public.store_customers;
create policy "workspace members read store customers"
on public.store_customers
for select
to authenticated
using (public.can_access_workspace(workspace_id));

drop policy if exists "workspace managers write store customers" on public.store_customers;
create policy "workspace managers write store customers"
on public.store_customers
for all
to authenticated
using (public.workspace_can_edit(workspace_id))
with check (public.workspace_can_edit(workspace_id));

drop policy if exists "workspace members read customer addresses" on public.customer_addresses;
create policy "workspace members read customer addresses"
on public.customer_addresses
for select
to authenticated
using (public.can_access_workspace(workspace_id));

drop policy if exists "workspace managers write customer addresses" on public.customer_addresses;
create policy "workspace managers write customer addresses"
on public.customer_addresses
for all
to authenticated
using (public.workspace_can_edit(workspace_id))
with check (public.workspace_can_edit(workspace_id));

drop policy if exists "workspace members read customer notes" on public.customer_notes;
create policy "workspace members read customer notes"
on public.customer_notes
for select
to authenticated
using (public.can_access_workspace(workspace_id));

drop policy if exists "workspace managers write customer notes" on public.customer_notes;
create policy "workspace managers write customer notes"
on public.customer_notes
for all
to authenticated
using (public.workspace_can_edit(workspace_id))
with check (public.workspace_can_edit(workspace_id));
