-- Store owner customers foundation.
-- Additive only: creates isolated customer records for claimed store owners.

create extension if not exists "pgcrypto";

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  store_instance_id uuid not null references public.store_instances(id) on delete cascade,
  customer_reference text,
  name text not null,
  email text,
  phone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists customers_store_reference_idx
  on public.customers(store_instance_id, customer_reference)
  where customer_reference is not null;

create index if not exists customers_store_created_idx
  on public.customers(store_instance_id, created_at desc);

create index if not exists customers_store_email_idx
  on public.customers(store_instance_id, lower(email))
  where email is not null;

create index if not exists customers_store_phone_idx
  on public.customers(store_instance_id, phone)
  where phone is not null;

alter table public.customers enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'customers'
      and policyname = 'Buyer store members read customers'
  ) then
    create policy "Buyer store members read customers"
      on public.customers for select
      using (public.can_access_store_instance(store_instance_id));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'customers'
      and policyname = 'Buyer store managers write customers'
  ) then
    create policy "Buyer store managers write customers"
      on public.customers for all
      using (public.can_manage_store_instance(store_instance_id))
      with check (public.can_manage_store_instance(store_instance_id));
  end if;
end $$;

create or replace function public.set_store_owner_customers_updated_at()
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
  if not exists (select 1 from pg_trigger where tgname = 'customers_updated_at') then
    create trigger customers_updated_at
      before update on public.customers
      for each row execute function public.set_store_owner_customers_updated_at();
  end if;
end $$;
