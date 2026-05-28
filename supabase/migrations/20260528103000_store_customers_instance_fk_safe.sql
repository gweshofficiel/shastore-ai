-- Store customers instance FK/runtime safety.
-- Additive only: fixes legacy customers.store_instance_id -> store_instances FK conflicts
-- when modern store-mode orders use public.stores.id as the runtime instance id.

-- Ensure modern customer columns exist on legacy customers tables.
alter table if exists public.customers
  add column if not exists store_id uuid references public.stores(id) on delete cascade,
  add column if not exists workspace_id uuid,
  add column if not exists normalized_phone text,
  add column if not exists normalized_email text,
  add column if not exists status text not null default 'active',
  add column if not exists total_orders integer not null default 0,
  add column if not exists total_spent numeric(12, 2) not null default 0,
  add column if not exists first_order_at timestamptz,
  add column if not exists last_order_at timestamptz,
  add column if not exists last_order_id uuid,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

-- Legacy foundation used store_instances FK + NOT NULL; modern runtime uses stores.id.
alter table if exists public.customers
  alter column store_instance_id drop not null;

do $$
declare
  fk_row record;
begin
  if to_regclass('public.customers') is null then
    return;
  end if;

  for fk_row in
    select c.conname
    from pg_constraint c
    where c.conrelid = 'public.customers'::regclass
      and c.contype = 'f'
      and c.confrelid = 'public.store_instances'::regclass
  loop
    execute format('alter table public.customers drop constraint if exists %I', fk_row.conname);
  end loop;
end $$;

-- Align store_id from known-good store references before re-adding a stores-scoped FK.
update public.customers customers
set store_id = coalesce(customers.store_id, customers.store_instance_id)
where customers.store_id is null
  and customers.store_instance_id is not null
  and exists (
    select 1
    from public.stores stores
    where stores.id = customers.store_instance_id
  );

-- Legacy rows: store_instance_id pointed at store_instances; map to stores when ids align.
do $$
begin
  if to_regclass('public.store_instances') is null or to_regclass('public.stores') is null then
    return;
  end if;

  update public.customers customers
  set store_id = coalesce(customers.store_id, instances.id)
  from public.store_instances instances
  join public.stores stores on stores.id = instances.id
  where customers.store_id is null
    and customers.store_instance_id = instances.id;
exception
  when others then
    raise notice 'customers legacy store_instances store_id backfill skipped: %', sqlerrm;
end $$;

update public.customers customers
set store_instance_id = customers.store_id
where customers.store_instance_id is null
  and customers.store_id is not null
  and exists (
    select 1
    from public.stores stores
    where stores.id = customers.store_id
  );

-- Clear invalid instance ids that cannot satisfy a stores-scoped runtime model.
update public.customers customers
set store_instance_id = null
where customers.store_instance_id is not null
  and not exists (
    select 1
    from public.stores stores
    where stores.id = customers.store_instance_id
  );

do $$
begin
  if to_regclass('public.customers') is null or to_regclass('public.stores') is null then
    return;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.customers'::regclass
      and contype = 'f'
      and conname = 'customers_store_instance_id_stores_fkey'
  ) then
    alter table public.customers
      add constraint customers_store_instance_id_stores_fkey
      foreign key (store_instance_id) references public.stores(id) on delete cascade;
  end if;
exception
  when others then
    raise notice 'customers store_instance_id stores FK skipped: %', sqlerrm;
end $$;

update public.customers customers
set workspace_id = coalesce(orders.workspace_id, stores.workspace_id, orders.owner_user_id, orders.user_id)
from public.store_orders orders
left join public.stores stores on stores.id = orders.store_id
where customers.workspace_id is null
  and customers.store_id = orders.store_id
  and (
    (customers.normalized_phone is not null and regexp_replace(coalesce(orders.customer_phone, ''), '[^0-9+]', '', 'g') = customers.normalized_phone)
    or (customers.normalized_email is not null and lower(trim(coalesce(orders.customer_email, ''))) = customers.normalized_email)
  );

update public.customers customers
set workspace_id = coalesce(orders.workspace_id, stores.workspace_id, orders.owner_user_id, orders.user_id)
from public.orders orders
left join public.stores stores on stores.id = coalesce(orders.store_id, orders.store_instance_id)
where customers.workspace_id is null
  and customers.store_id = coalesce(orders.store_id, orders.store_instance_id)
  and (
    (customers.normalized_phone is not null and regexp_replace(coalesce(orders.customer_phone, ''), '[^0-9+]', '', 'g') = customers.normalized_phone)
    or (customers.normalized_email is not null and lower(trim(coalesce(orders.customer_email, ''))) = customers.normalized_email)
  );

create or replace function public.resolve_customer_store_id(
  candidate_store_id uuid,
  candidate_store_instance_id uuid
)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select stores.id
      from public.stores stores
      where stores.id = candidate_store_id
      limit 1
    ),
    (
      select stores.id
      from public.stores stores
      where stores.id = candidate_store_instance_id
      limit 1
    )
  );
$$;

create or replace function public.resolve_customer_store_instance_id(
  candidate_store_id uuid,
  candidate_store_instance_id uuid
)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select case
    when candidate_store_instance_id is not null
      and exists (
        select 1
        from public.stores stores
        where stores.id = candidate_store_instance_id
      ) then candidate_store_instance_id
    when candidate_store_id is not null
      and exists (
        select 1
        from public.stores stores
        where stores.id = candidate_store_id
      ) then candidate_store_id
    else null
  end;
$$;

grant execute on function public.resolve_customer_store_id(uuid, uuid) to authenticated;
grant execute on function public.resolve_customer_store_instance_id(uuid, uuid) to authenticated;

create or replace function public.set_customers_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.normalized_phone = nullif(regexp_replace(coalesce(new.phone, ''), '[^0-9+]', '', 'g'), '');
  new.normalized_email = nullif(lower(trim(coalesce(new.email, ''))), '');
  new.store_id = public.resolve_customer_store_id(new.store_id, new.store_instance_id);
  new.store_instance_id = public.resolve_customer_store_instance_id(new.store_id, new.store_instance_id);
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
  clean_store_id uuid;
  clean_store_instance_id uuid;
  clean_workspace_id uuid := candidate_workspace_id;
  order_total numeric := coalesce(candidate_total, 0);
begin
  clean_store_id := public.resolve_customer_store_id(candidate_store_id, candidate_store_instance_id);
  clean_store_instance_id := public.resolve_customer_store_instance_id(candidate_store_id, candidate_store_instance_id);

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
      store_id = clean_store_id,
      store_instance_id = coalesce(
        public.resolve_customer_store_instance_id(customers.store_id, customers.store_instance_id),
        clean_store_instance_id
      ),
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

-- Ensure order sync triggers exist after FK/runtime repair.
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

-- Re-sync customers from historical orders (skips invalid rows without aborting the migration).
do $$
declare
  order_row record;
begin
  if to_regclass('public.store_orders') is not null then
    for order_row in
      select
        id,
        workspace_id,
        store_id,
        store_instance_id,
        customer_name,
        customer_phone,
        customer_email,
        total,
        order_status,
        created_at
      from public.store_orders
      where customer_phone is not null or customer_email is not null
      order by created_at asc
    loop
      begin
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
      exception
        when others then
          raise notice 'store_orders customer backfill skipped order %: %', order_row.id, sqlerrm;
      end;
    end loop;
  end if;

  if to_regclass('public.orders') is not null then
    for order_row in
      select
        id,
        workspace_id,
        store_id,
        store_instance_id,
        customer_name,
        customer_phone,
        customer_email,
        total,
        order_status,
        created_at
      from public.orders
      where customer_phone is not null or customer_email is not null
      order by created_at asc
    loop
      begin
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
      exception
        when others then
          raise notice 'orders customer backfill skipped order %: %', order_row.id, sqlerrm;
      end;
    end loop;
  end if;
end $$;
