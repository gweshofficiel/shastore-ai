-- Store customers foundation.
-- Additive only: derives customer records from real store orders and keeps order systems intact.

create extension if not exists "pgcrypto";

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references public.stores(id) on delete cascade,
  store_instance_id uuid references public.stores(id) on delete cascade,
  workspace_id uuid,
  name text not null,
  phone text,
  email text,
  normalized_phone text,
  normalized_email text,
  status text not null default 'active',
  total_orders integer not null default 0,
  total_spent numeric(12, 2) not null default 0,
  first_order_at timestamptz,
  last_order_at timestamptz,
  last_order_id uuid,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.customers
  add column if not exists store_id uuid references public.stores(id) on delete cascade,
  add column if not exists store_instance_id uuid references public.stores(id) on delete cascade,
  add column if not exists workspace_id uuid,
  add column if not exists phone text,
  add column if not exists email text,
  add column if not exists normalized_phone text,
  add column if not exists normalized_email text,
  add column if not exists status text not null default 'active',
  add column if not exists total_orders integer not null default 0,
  add column if not exists total_spent numeric(12, 2) not null default 0,
  add column if not exists first_order_at timestamptz,
  add column if not exists last_order_at timestamptz,
  add column if not exists last_order_id uuid,
  add column if not exists notes text,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update public.customers
set
  normalized_phone = nullif(regexp_replace(coalesce(phone, ''), '[^0-9+]', '', 'g'), ''),
  normalized_email = nullif(lower(trim(coalesce(email, ''))), ''),
  store_instance_id = coalesce(store_instance_id, store_id),
  status = coalesce(nullif(status, ''), 'active')
where normalized_phone is null
   or normalized_email is null
   or store_instance_id is null
   or status is null
   or status = '';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'customers_status_check'
      and conrelid = 'public.customers'::regclass
  ) then
    alter table public.customers
      add constraint customers_status_check
      check (status in ('active', 'inactive'))
      not valid;
  end if;
end $$;

create unique index if not exists customers_store_phone_unique_idx
on public.customers(workspace_id, store_id, normalized_phone)
where normalized_phone is not null;

create unique index if not exists customers_store_email_unique_idx
on public.customers(workspace_id, store_id, normalized_email)
where normalized_email is not null;

create index if not exists customers_workspace_store_idx
on public.customers(workspace_id, store_id, updated_at desc);

create index if not exists customers_last_order_idx
on public.customers(workspace_id, store_id, last_order_at desc);

create or replace function public.set_customers_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.normalized_phone = nullif(regexp_replace(coalesce(new.phone, ''), '[^0-9+]', '', 'g'), '');
  new.normalized_email = nullif(lower(trim(coalesce(new.email, ''))), '');
  new.store_instance_id = coalesce(new.store_instance_id, new.store_id);
  return new;
end;
$$;

drop trigger if exists customers_updated_at on public.customers;
create trigger customers_updated_at
before insert or update on public.customers
for each row execute function public.set_customers_updated_at();

create or replace function public.upsert_store_customer_from_order(
  candidate_workspace_id uuid,
  candidate_store_id uuid,
  candidate_store_instance_id uuid,
  candidate_order_id uuid,
  candidate_name text,
  candidate_phone text,
  candidate_email text,
  candidate_total numeric,
  candidate_order_status text,
  candidate_created_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  customer_id_value uuid;
  clean_name text := nullif(trim(coalesce(candidate_name, '')), '');
  clean_phone text := nullif(trim(coalesce(candidate_phone, '')), '');
  clean_email text := nullif(lower(trim(coalesce(candidate_email, ''))), '');
  clean_normalized_phone text := nullif(regexp_replace(coalesce(candidate_phone, ''), '[^0-9+]', '', 'g'), '');
  clean_store_id uuid := coalesce(candidate_store_id, candidate_store_instance_id);
  clean_store_instance_id uuid := coalesce(candidate_store_instance_id, candidate_store_id);
  clean_workspace_id uuid := candidate_workspace_id;
  order_total numeric := coalesce(candidate_total, 0);
begin
  if clean_store_id is null or clean_workspace_id is null or (clean_normalized_phone is null and clean_email is null) then
    return null;
  end if;

  select id
  into customer_id_value
  from public.customers
  where workspace_id = clean_workspace_id
    and store_id = clean_store_id
    and (
      (clean_normalized_phone is not null and normalized_phone = clean_normalized_phone)
      or (clean_email is not null and normalized_email = clean_email)
    )
  order by updated_at desc
  limit 1;

  if customer_id_value is null then
    insert into public.customers (
      store_id,
      store_instance_id,
      workspace_id,
      name,
      phone,
      email,
      normalized_phone,
      normalized_email,
      total_orders,
      total_spent,
      first_order_at,
      last_order_at,
      last_order_id,
      metadata
    )
    values (
      clean_store_id,
      clean_store_instance_id,
      clean_workspace_id,
      coalesce(clean_name, 'Customer'),
      clean_phone,
      clean_email,
      clean_normalized_phone,
      clean_email,
      1,
      case when candidate_order_status in ('cancelled', 'canceled') then 0 else order_total end,
      candidate_created_at,
      candidate_created_at,
      candidate_order_id,
      jsonb_build_object('source', 'order')
    )
    returning id into customer_id_value;
  else
    update public.customers
    set
      name = coalesce(nullif(customers.name, ''), clean_name, 'Customer'),
      phone = coalesce(customers.phone, clean_phone),
      email = coalesce(customers.email, clean_email),
      store_instance_id = coalesce(customers.store_instance_id, clean_store_instance_id),
      total_orders = greatest(customers.total_orders, 0) + 1,
      total_spent = greatest(customers.total_spent, 0) + case when candidate_order_status in ('cancelled', 'canceled') then 0 else order_total end,
      first_order_at = least(coalesce(customers.first_order_at, candidate_created_at), candidate_created_at),
      last_order_at = greatest(coalesce(customers.last_order_at, candidate_created_at), candidate_created_at),
      last_order_id = candidate_order_id
    where id = customer_id_value;
  end if;

  return customer_id_value;
end;
$$;

grant execute on function public.upsert_store_customer_from_order(uuid, uuid, uuid, uuid, text, text, text, numeric, text, timestamptz) to authenticated;

create or replace function public.sync_store_order_customer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.upsert_store_customer_from_order(
    new.workspace_id,
    new.store_id,
    new.store_instance_id,
    new.id,
    new.customer_name,
    new.customer_phone,
    new.customer_email,
    new.total,
    new.order_status,
    new.created_at
  );
  return new;
end;
$$;

create or replace function public.sync_order_customer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.upsert_store_customer_from_order(
    new.workspace_id,
    new.store_id,
    new.store_instance_id,
    new.id,
    new.customer_name,
    new.customer_phone,
    new.customer_email,
    new.total,
    new.order_status,
    new.created_at
  );
  return new;
end;
$$;

do $$
begin
  if to_regclass('public.store_orders') is not null then
    drop trigger if exists store_orders_customer_sync on public.store_orders;
    create trigger store_orders_customer_sync
    after insert on public.store_orders
    for each row execute function public.sync_store_order_customer();
  end if;

  if to_regclass('public.orders') is not null then
    drop trigger if exists orders_customer_sync on public.orders;
    create trigger orders_customer_sync
    after insert on public.orders
    for each row execute function public.sync_order_customer();
  end if;
end $$;

do $$
declare
  order_row record;
begin
  if to_regclass('public.store_orders') is not null then
    for order_row in
      select id, workspace_id, store_id, store_instance_id, customer_name, customer_phone, customer_email, total, order_status, created_at
      from public.store_orders
      where customer_phone is not null or customer_email is not null
      order by created_at asc
    loop
      perform public.upsert_store_customer_from_order(
        order_row.workspace_id,
        order_row.store_id,
        order_row.store_instance_id,
        order_row.id,
        order_row.customer_name,
        order_row.customer_phone,
        order_row.customer_email,
        order_row.total,
        order_row.order_status,
        order_row.created_at
      );
    end loop;
  end if;

  if to_regclass('public.orders') is not null then
    for order_row in
      select id, workspace_id, store_id, store_instance_id, customer_name, customer_phone, customer_email, total, order_status, created_at
      from public.orders
      where customer_phone is not null or customer_email is not null
      order by created_at asc
    loop
      perform public.upsert_store_customer_from_order(
        order_row.workspace_id,
        order_row.store_id,
        order_row.store_instance_id,
        order_row.id,
        order_row.customer_name,
        order_row.customer_phone,
        order_row.customer_email,
        order_row.total,
        order_row.order_status,
        order_row.created_at
      );
    end loop;
  end if;
end $$;

alter table public.customers enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'customers'
      and policyname = 'workspace members read customers'
  ) then
    create policy "workspace members read customers"
    on public.customers
    for select
    to authenticated
    using (public.can_access_workspace(workspace_id));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'customers'
      and policyname = 'workspace managers write customers'
  ) then
    create policy "workspace managers write customers"
    on public.customers
    for all
    to authenticated
    using (public.workspace_can_edit(workspace_id))
    with check (public.workspace_can_edit(workspace_id));
  end if;
end $$;
