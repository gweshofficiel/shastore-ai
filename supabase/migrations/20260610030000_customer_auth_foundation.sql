-- PHASE C5: Real authenticated customer account foundation.
--
-- Additive only:
-- - Keeps guest checkout working.
-- - Adds customer auth profile linkage without replacing store customer/order flows.
-- - Does not expose customer data by phone-only RLS paths.

create extension if not exists "pgcrypto";

create table if not exists public.customer_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  email text not null,
  phone text not null,
  name text,
  normalized_email text,
  normalized_phone text,
  status text not null default 'active' check (status in ('active', 'suspended', 'disabled')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists customer_profiles_email_unique_idx
on public.customer_profiles(normalized_email)
where normalized_email is not null;

create index if not exists customer_profiles_phone_idx
on public.customer_profiles(normalized_phone);

alter table if exists public.store_customers
  add column if not exists customer_auth_user_id uuid references auth.users(id) on delete set null,
  add column if not exists customer_profile_id uuid references public.customer_profiles(id) on delete set null;

alter table if exists public.orders
  add column if not exists customer_auth_user_id uuid references auth.users(id) on delete set null,
  add column if not exists customer_profile_id uuid references public.customer_profiles(id) on delete set null;

alter table if exists public.store_orders
  add column if not exists customer_auth_user_id uuid references auth.users(id) on delete set null,
  add column if not exists customer_profile_id uuid references public.customer_profiles(id) on delete set null;

create index if not exists store_customers_auth_user_idx
on public.store_customers(customer_auth_user_id, store_id, updated_at desc)
where customer_auth_user_id is not null;

create index if not exists orders_customer_auth_user_idx
on public.orders(customer_auth_user_id, store_id, created_at desc)
where customer_auth_user_id is not null;

create index if not exists store_orders_customer_auth_user_idx
on public.store_orders(customer_auth_user_id, store_id, created_at desc)
where customer_auth_user_id is not null;

create or replace function public.set_customer_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.email = lower(trim(new.email));
  new.phone = nullif(trim(coalesce(new.phone, '')), '');
  new.name = nullif(trim(coalesce(new.name, '')), '');
  new.normalized_email = nullif(lower(trim(coalesce(new.email, ''))), '');
  new.normalized_phone = nullif(regexp_replace(coalesce(new.phone, ''), '[^0-9+]', '', 'g'), '');
  return new;
end;
$$;

drop trigger if exists customer_profiles_updated_at on public.customer_profiles;
create trigger customer_profiles_updated_at
before insert or update on public.customer_profiles
for each row execute function public.set_customer_profiles_updated_at();

alter table public.customer_profiles enable row level security;

drop policy if exists "customers read own profile" on public.customer_profiles;
drop policy if exists "customers update own profile" on public.customer_profiles;
drop policy if exists "service role manages customer profiles" on public.customer_profiles;

create policy "customers read own profile"
on public.customer_profiles for select to authenticated
using (auth.uid() = user_id);

create policy "customers update own profile"
on public.customer_profiles for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "service role manages customer profiles"
on public.customer_profiles for all to service_role
using (true)
with check (true);

grant select, update on public.customer_profiles to authenticated;
grant all on public.customer_profiles to service_role;

-- Backfill customer profiles for existing customer role users.
insert into public.customer_profiles (user_id, email, phone, name, status, metadata)
select
  roles.user_id,
  lower(users.email),
  coalesce(
    nullif(users.raw_user_meta_data->>'phone', ''),
    nullif(customers.phone, ''),
    '+15551234567'
  ),
  coalesce(users.raw_user_meta_data->>'name', users.raw_user_meta_data->>'full_name', customers.name, split_part(users.email, '@', 1)),
  case when roles.status in ('active', 'pending') then 'active' else 'suspended' end,
  jsonb_build_object('source', 'customer_auth_foundation')
from public.account_roles roles
join auth.users users on users.id = roles.user_id
left join public.store_customers customers
  on lower(coalesce(customers.normalized_email, customers.email)) = lower(users.email)
where roles.role = 'customer'
  and users.email is not null
on conflict (user_id) do nothing;

-- Link store customer identities and historical orders by authenticated customer profile.
update public.store_customers customers
set
  customer_auth_user_id = profiles.user_id,
  customer_profile_id = profiles.id,
  metadata = coalesce(customers.metadata, '{}'::jsonb) || jsonb_build_object(
    'auth_user_id', profiles.user_id,
    'auth_link_source', 'customer_auth_foundation'
  ),
  updated_at = now()
from public.customer_profiles profiles
where (
  lower(coalesce(customers.normalized_email, customers.email)) = profiles.normalized_email
  or nullif(regexp_replace(coalesce(customers.normalized_phone, customers.phone, ''), '[^0-9+]', '', 'g'), '') = profiles.normalized_phone
);

update public.orders orders
set
  customer_auth_user_id = profiles.user_id,
  customer_profile_id = profiles.id
from public.customer_profiles profiles
where (
  lower(coalesce(orders.customer_email, '')) = profiles.normalized_email
  or nullif(regexp_replace(coalesce(orders.customer_phone, ''), '[^0-9+]', '', 'g'), '') = profiles.normalized_phone
);

update public.store_orders orders
set
  customer_auth_user_id = profiles.user_id,
  customer_profile_id = profiles.id
from public.customer_profiles profiles
where (
  lower(coalesce(orders.customer_email, '')) = profiles.normalized_email
  or nullif(regexp_replace(coalesce(orders.customer_phone, ''), '[^0-9+]', '', 'g'), '') = profiles.normalized_phone
);
