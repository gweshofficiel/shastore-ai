-- PHASE: Customer identity linking foundation.
--
-- Additive only:
-- - customer_profiles is the global customer identity.
-- - customer_store_links is the many-store relationship.
-- - orders and store customer identities are backfilled by auth user, normalized email, and normalized phone.

create extension if not exists "pgcrypto";

create table if not exists public.customer_store_links (
  id uuid primary key default gen_random_uuid(),
  customer_profile_id uuid not null references public.customer_profiles(id) on delete cascade,
  customer_auth_user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid,
  store_id uuid not null references public.stores(id) on delete cascade,
  store_customer_id uuid references public.store_customers(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'suspended', 'disabled')),
  orders_count integer not null default 0 check (orders_count >= 0),
  latest_order_at timestamptz,
  first_linked_at timestamptz not null default now(),
  last_linked_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (customer_profile_id, store_id)
);

create index if not exists customer_store_links_user_idx
on public.customer_store_links(customer_auth_user_id, status, latest_order_at desc nulls last);

create index if not exists customer_store_links_store_idx
on public.customer_store_links(store_id, status, latest_order_at desc nulls last);

create index if not exists customer_store_links_profile_idx
on public.customer_store_links(customer_profile_id, status, latest_order_at desc nulls last);

create or replace function public.set_customer_store_links_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.last_linked_at = coalesce(new.last_linked_at, now());
  return new;
end;
$$;

drop trigger if exists customer_store_links_updated_at on public.customer_store_links;
create trigger customer_store_links_updated_at
before insert or update on public.customer_store_links
for each row execute function public.set_customer_store_links_updated_at();

alter table public.customer_store_links enable row level security;

drop policy if exists "customers read own store links" on public.customer_store_links;
drop policy if exists "service role manages customer store links" on public.customer_store_links;

create policy "customers read own store links"
on public.customer_store_links for select to authenticated
using (auth.uid() = customer_auth_user_id);

create policy "service role manages customer store links"
on public.customer_store_links for all to service_role
using (true)
with check (true);

grant select on public.customer_store_links to authenticated;
grant all on public.customer_store_links to service_role;

-- Keep direct columns synchronized for historical store customer rows.
update public.store_customers customers
set
  customer_auth_user_id = profiles.user_id,
  customer_profile_id = profiles.id,
  metadata = coalesce(customers.metadata, '{}'::jsonb) || jsonb_build_object(
    'auth_user_id', profiles.user_id,
    'auth_link_source', 'customer_identity_store_links'
  ),
  updated_at = now()
from public.customer_profiles profiles
where customers.customer_profile_id is null
  and (
    lower(coalesce(customers.normalized_email, customers.email)) = profiles.normalized_email
    or nullif(regexp_replace(coalesce(customers.normalized_phone, customers.phone, ''), '[^0-9+]', '', 'g'), '') = profiles.normalized_phone
    or customers.metadata->>'auth_user_id' = profiles.user_id::text
  );

update public.orders orders
set
  customer_auth_user_id = profiles.user_id,
  customer_profile_id = profiles.id
from public.customer_profiles profiles
where orders.customer_profile_id is null
  and (
    lower(coalesce(orders.customer_email, '')) = profiles.normalized_email
    or nullif(regexp_replace(coalesce(orders.customer_phone, ''), '[^0-9+]', '', 'g'), '') = profiles.normalized_phone
  );

update public.store_orders orders
set
  customer_auth_user_id = profiles.user_id,
  customer_profile_id = profiles.id
from public.customer_profiles profiles
where orders.customer_profile_id is null
  and (
    lower(coalesce(orders.customer_email, '')) = profiles.normalized_email
    or nullif(regexp_replace(coalesce(orders.customer_phone, ''), '[^0-9+]', '', 'g'), '') = profiles.normalized_phone
  );

-- Build explicit customer -> store links from store customers.
-- Multiple store_customers rows can match the same profile+store after auth backfill.
-- Deduplicate with DISTINCT ON before INSERT so ON CONFLICT never sees duplicate keys.
with store_customer_source as (
  select distinct on (customers.customer_profile_id, customers.store_id)
    customers.customer_profile_id,
    customers.customer_auth_user_id,
    customers.workspace_id,
    customers.store_id,
    customers.id as store_customer_id,
    coalesce(customers.total_orders, 0)::integer as orders_count,
    customers.last_order_at as latest_order_at
  from public.store_customers customers
  where customers.customer_profile_id is not null
    and customers.customer_auth_user_id is not null
    and customers.store_id is not null
  order by
    customers.customer_profile_id,
    customers.store_id,
    customers.last_order_at desc nulls last,
    coalesce(customers.total_orders, 0) desc,
    customers.updated_at desc nulls last
)
insert into public.customer_store_links (
  customer_profile_id,
  customer_auth_user_id,
  workspace_id,
  store_id,
  store_customer_id,
  orders_count,
  latest_order_at,
  metadata
)
select
  store_customer_source.customer_profile_id,
  store_customer_source.customer_auth_user_id,
  store_customer_source.workspace_id,
  store_customer_source.store_id,
  store_customer_source.store_customer_id,
  store_customer_source.orders_count,
  store_customer_source.latest_order_at,
  jsonb_build_object('source', 'store_customers_backfill')
from store_customer_source
on conflict (customer_profile_id, store_id) do update
set
  customer_auth_user_id = excluded.customer_auth_user_id,
  workspace_id = coalesce(excluded.workspace_id, customer_store_links.workspace_id),
  store_customer_id = coalesce(excluded.store_customer_id, customer_store_links.store_customer_id),
  orders_count = greatest(customer_store_links.orders_count, excluded.orders_count),
  latest_order_at = greatest(customer_store_links.latest_order_at, excluded.latest_order_at),
  last_linked_at = now(),
  metadata = coalesce(customer_store_links.metadata, '{}'::jsonb) || excluded.metadata;

-- Build links directly from historical order rows when a store_customer row is absent.
-- One representative order row per profile+store (DISTINCT ON), with aggregated counts.
with linked_orders as (
  select
    orders.customer_profile_id as profile_id,
    orders.customer_auth_user_id as auth_user_id,
    orders.workspace_id,
    coalesce(orders.store_id, orders.store_instance_id) as store_id,
    orders.created_at
  from public.orders orders
  where orders.customer_profile_id is not null
    and orders.customer_auth_user_id is not null
    and coalesce(orders.store_id, orders.store_instance_id) is not null
  union all
  select
    orders.customer_profile_id as profile_id,
    orders.customer_auth_user_id as auth_user_id,
    orders.workspace_id,
    orders.store_id,
    orders.created_at
  from public.store_orders orders
  where orders.customer_profile_id is not null
    and orders.customer_auth_user_id is not null
    and orders.store_id is not null
),
order_source as (
  select distinct on (linked_orders.profile_id, linked_orders.store_id)
    linked_orders.profile_id,
    linked_orders.auth_user_id,
    linked_orders.workspace_id,
    linked_orders.store_id,
    linked_orders.created_at as latest_order_at
  from linked_orders
  order by
    linked_orders.profile_id,
    linked_orders.store_id,
    linked_orders.created_at desc nulls last
),
order_counts as (
  select
    linked_orders.profile_id,
    linked_orders.store_id,
    count(*)::integer as orders_count,
    max(linked_orders.created_at) as latest_order_at
  from linked_orders
  group by linked_orders.profile_id, linked_orders.store_id
)
insert into public.customer_store_links (
  customer_profile_id,
  customer_auth_user_id,
  workspace_id,
  store_id,
  orders_count,
  latest_order_at,
  metadata
)
select
  order_source.profile_id,
  order_source.auth_user_id,
  order_source.workspace_id,
  order_source.store_id,
  order_counts.orders_count,
  order_counts.latest_order_at,
  jsonb_build_object('source', 'orders_backfill')
from order_source
join order_counts
  on order_counts.profile_id = order_source.profile_id
 and order_counts.store_id = order_source.store_id
on conflict (customer_profile_id, store_id) do update
set
  customer_auth_user_id = excluded.customer_auth_user_id,
  workspace_id = coalesce(excluded.workspace_id, customer_store_links.workspace_id),
  orders_count = greatest(customer_store_links.orders_count, excluded.orders_count),
  latest_order_at = greatest(customer_store_links.latest_order_at, excluded.latest_order_at),
  last_linked_at = now(),
  metadata = coalesce(customer_store_links.metadata, '{}'::jsonb) || excluded.metadata;

create or replace view public.customer_identity_debug as
select
  profiles.id as customer_profile_id,
  profiles.user_id as customer_auth_user_id,
  profiles.email,
  profiles.phone,
  profiles.normalized_email,
  profiles.normalized_phone,
  count(distinct links.store_id) as linked_store_count,
  coalesce(sum(links.orders_count), 0)::integer as linked_order_count,
  max(links.latest_order_at) as latest_activity_at
from public.customer_profiles profiles
left join public.customer_store_links links
  on links.customer_profile_id = profiles.id
group by profiles.id, profiles.user_id, profiles.email, profiles.phone, profiles.normalized_email, profiles.normalized_phone;

revoke all on public.customer_identity_debug from public, anon, authenticated;
grant select on public.customer_identity_debug to service_role;

-- Test data foundation: create a second store link/order for customer.test when the C3 store exists.
do $$
declare
  owner_id uuid;
  customer_user_id uuid;
  customer_profile_record record;
  source_store record;
  second_store_id uuid;
  store_customer_id uuid;
  order_id uuid;
begin
  select id into owner_id from auth.users where lower(email) = 'owner.test@shastore.test' limit 1;
  select id into customer_user_id from auth.users where lower(email) = 'customer.test@shastore.test' limit 1;
  select * into customer_profile_record from public.customer_profiles where user_id = customer_user_id limit 1;
  select * into source_store from public.stores where slug = 'c3-test-store' limit 1;

  if owner_id is null or customer_user_id is null or customer_profile_record.id is null or source_store.id is null then
    return;
  end if;

  select id into second_store_id from public.stores where slug = 'c5-customer-test-store' limit 1;

  if second_store_id is null then
    insert into public.stores (
      user_id,
      owner_user_id,
      workspace_id,
      name,
      slug,
      status,
      is_active,
      currency,
      created_at,
      updated_at
    )
    values (
      coalesce(source_store.user_id, owner_id),
      coalesce(source_store.owner_user_id, owner_id),
      coalesce(source_store.workspace_id, owner_id),
      'C5 Customer Test Store',
      'c5-customer-test-store',
      'published',
      true,
      coalesce(source_store.currency, 'USD'),
      now(),
      now()
    )
    returning id into second_store_id;
  end if;

  if to_regclass('public.published_stores') is not null then
    insert into public.published_stores (
      store_id,
      user_id,
      workspace_id,
      slug,
      url,
      status,
      visibility,
      published_at,
      updated_at
    )
    values (
      second_store_id,
      coalesce(source_store.owner_user_id, source_store.user_id, owner_id),
      coalesce(source_store.workspace_id, owner_id),
      'c5-customer-test-store',
      '/store/c5-customer-test-store',
      'published',
      'public',
      now(),
      now()
    )
    on conflict (store_id) do update
    set
      slug = excluded.slug,
      url = excluded.url,
      status = excluded.status,
      visibility = excluded.visibility,
      updated_at = now();
  end if;

  insert into public.store_customers (
    workspace_id,
    store_id,
    name,
    email,
    phone,
    normalized_email,
    normalized_phone,
    status,
    customer_auth_user_id,
    customer_profile_id,
    total_orders,
    total_spent,
    last_order_at,
    metadata,
    updated_at
  )
  values (
    coalesce(source_store.workspace_id, owner_id),
    second_store_id,
    'Customer Test',
    'customer.test@shastore.test',
    '+15551234567',
    'customer.test@shastore.test',
    '+15551234567',
    'active',
    customer_user_id,
    customer_profile_record.id,
    1,
    42.00,
    now(),
    jsonb_build_object('source', 'customer_identity_store_links_seed', 'auth_user_id', customer_user_id),
    now()
  )
  on conflict (workspace_id, store_id, normalized_email) where normalized_email is not null
  do update
  set
    customer_auth_user_id = excluded.customer_auth_user_id,
    customer_profile_id = excluded.customer_profile_id,
    total_orders = greatest(public.store_customers.total_orders, excluded.total_orders),
    total_spent = greatest(public.store_customers.total_spent, excluded.total_spent),
    last_order_at = greatest(public.store_customers.last_order_at, excluded.last_order_at),
    metadata = coalesce(public.store_customers.metadata, '{}'::jsonb) || excluded.metadata,
    updated_at = now()
  returning id into store_customer_id;

  insert into public.store_orders (
    store_id,
    user_id,
    owner_user_id,
    workspace_id,
    customer_name,
    customer_phone,
    customer_email,
    customer_auth_user_id,
    customer_profile_id,
    items,
    subtotal,
    total,
    currency,
    payment_method,
    payment_status,
    order_status,
    created_at,
    updated_at
  )
  select
    second_store_id,
    coalesce(source_store.user_id, owner_id),
    coalesce(source_store.owner_user_id, owner_id),
    coalesce(source_store.workspace_id, owner_id),
    'Customer Test',
    '+15551234567',
    'customer.test@shastore.test',
    customer_user_id,
    customer_profile_record.id,
    '[{"title":"C5 Linked Store Test Item","quantity":1,"price":42}]'::jsonb,
    42.00,
    42.00,
    coalesce(source_store.currency, 'USD'),
    'manual',
    'pending',
    'draft',
    now(),
    now()
  where not exists (
    select 1
    from public.store_orders existing
    where existing.store_id = second_store_id
      and existing.customer_auth_user_id = customer_user_id
      and existing.customer_email = 'customer.test@shastore.test'
      and existing.items::text ilike '%C5 Linked Store Test Item%'
  )
  returning id into order_id;

  if order_id is null then
    select id into order_id
    from public.store_orders existing
    where existing.store_id = second_store_id
      and existing.customer_auth_user_id = customer_user_id
      and existing.customer_email = 'customer.test@shastore.test'
    order by existing.created_at desc
    limit 1;
  end if;

  insert into public.customer_store_links (
    customer_profile_id,
    customer_auth_user_id,
    workspace_id,
    store_id,
    store_customer_id,
    orders_count,
    latest_order_at,
    metadata
  )
  values (
    customer_profile_record.id,
    customer_user_id,
    coalesce(source_store.workspace_id, owner_id),
    second_store_id,
    store_customer_id,
    1,
    now(),
    jsonb_build_object('source', 'customer_identity_store_links_seed', 'order_id', order_id)
  )
  on conflict (customer_profile_id, store_id) do update
  set
    store_customer_id = coalesce(excluded.store_customer_id, public.customer_store_links.store_customer_id),
    orders_count = greatest(public.customer_store_links.orders_count, excluded.orders_count),
    latest_order_at = greatest(public.customer_store_links.latest_order_at, excluded.latest_order_at),
    metadata = coalesce(public.customer_store_links.metadata, '{}'::jsonb) || excluded.metadata,
    last_linked_at = now();
end $$;

-- Diagnostic: confirm linked customer identity rows after migration/backfill.
select
  profiles.email as linked_customer_email,
  stores.slug as linked_store_slug,
  links.orders_count
from public.customer_store_links links
join public.customer_profiles profiles
  on profiles.id = links.customer_profile_id
join public.stores stores
  on stores.id = links.store_id
order by profiles.email, stores.slug;
