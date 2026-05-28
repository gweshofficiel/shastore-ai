-- Customer order sync runtime stabilization.
-- Additive only: makes order -> customer sync idempotent and tolerant of legacy order shapes.

create extension if not exists "pgcrypto";

create table if not exists public.customer_order_links (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  workspace_id uuid not null,
  store_id uuid not null references public.stores(id) on delete cascade,
  order_source text not null check (order_source in ('orders', 'store_orders')),
  order_id uuid not null,
  order_status text,
  order_total numeric(12, 2) not null default 0,
  order_created_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_source, order_id)
);

create index if not exists customer_order_links_customer_created_idx
on public.customer_order_links(customer_id, order_created_at desc);

create index if not exists customer_order_links_workspace_store_idx
on public.customer_order_links(workspace_id, store_id, order_created_at desc);

alter table public.customer_order_links enable row level security;

drop policy if exists "workspace members read customer order links" on public.customer_order_links;
create policy "workspace members read customer order links"
on public.customer_order_links
for select
to authenticated
using (public.can_access_workspace(workspace_id));

drop policy if exists "workspace managers write customer order links" on public.customer_order_links;
create policy "workspace managers write customer order links"
on public.customer_order_links
for all
to authenticated
using (public.workspace_can_edit(workspace_id))
with check (public.workspace_can_edit(workspace_id));

create or replace function public.resolve_customer_store_id(
  candidate_store_id uuid,
  candidate_store_instance_id uuid
)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  resolved_store_id uuid;
begin
  if candidate_store_id is not null then
    select stores.id
    into resolved_store_id
    from public.stores stores
    where stores.id = candidate_store_id
    limit 1;

    if resolved_store_id is not null then
      return resolved_store_id;
    end if;
  end if;

  if candidate_store_instance_id is not null then
    select stores.id
    into resolved_store_id
    from public.stores stores
    where stores.id = candidate_store_instance_id
    limit 1;

    if resolved_store_id is not null then
      return resolved_store_id;
    end if;
  end if;

  if candidate_store_instance_id is not null and to_regclass('public.store_instances') is not null then
    execute $sql$
      select stores.id
      from public.store_instances instances
      join public.stores stores on stores.slug = instances.internal_slug
      where instances.id = $1
      limit 1
    $sql$
    into resolved_store_id
    using candidate_store_instance_id;

    if resolved_store_id is not null then
      return resolved_store_id;
    end if;
  end if;

  return null;
end;
$$;

create or replace function public.resolve_customer_workspace_id(
  candidate_workspace_id uuid,
  candidate_store_id uuid,
  candidate_store_instance_id uuid
)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  resolved_store_id uuid;
  resolved_workspace_id uuid;
begin
  if candidate_workspace_id is not null then
    return candidate_workspace_id;
  end if;

  resolved_store_id := public.resolve_customer_store_id(candidate_store_id, candidate_store_instance_id);

  if resolved_store_id is not null then
    select coalesce(stores.workspace_id, stores.owner_user_id, stores.user_id)
    into resolved_workspace_id
    from public.stores stores
    where stores.id = resolved_store_id
    limit 1;
  end if;

  return resolved_workspace_id;
end;
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
grant execute on function public.resolve_customer_workspace_id(uuid, uuid, uuid) to authenticated;
grant execute on function public.resolve_customer_store_instance_id(uuid, uuid) to authenticated;

create or replace function public.recompute_customer_order_totals(candidate_customer_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if candidate_customer_id is null then
    return;
  end if;

  update public.customers customers
  set
    total_orders = coalesce(aggregates.total_orders, 0),
    total_spent = coalesce(aggregates.total_spent, 0),
    first_order_at = aggregates.first_order_at,
    last_order_at = aggregates.last_order_at,
    last_order_id = aggregates.last_order_id,
    updated_at = now()
  from (
    select
      count(*)::integer as total_orders,
      coalesce(
        sum(
          case
            when links.order_status in ('cancelled', 'canceled', 'refunded') then 0
            else coalesce(links.order_total, 0)
          end
        ),
        0
      )::numeric(12, 2) as total_spent,
      min(links.order_created_at) as first_order_at,
      max(links.order_created_at) as last_order_at,
      (
        array_agg(links.order_id order by links.order_created_at desc, links.updated_at desc)
      )[1] as last_order_id
    from public.customer_order_links links
    where links.customer_id = candidate_customer_id
  ) aggregates
  where customers.id = candidate_customer_id;
end;
$$;

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
  candidate_created_at timestamptz,
  candidate_order_source text default 'store_orders'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_email text := nullif(lower(trim(coalesce(candidate_email, ''))), '');
  clean_name text := nullif(trim(coalesce(candidate_name, '')), '');
  clean_normalized_phone text := nullif(regexp_replace(coalesce(candidate_phone, ''), '[^0-9+]', '', 'g'), '');
  clean_phone text := nullif(trim(coalesce(candidate_phone, '')), '');
  clean_store_id uuid;
  clean_store_instance_id uuid;
  clean_workspace_id uuid;
  customer_id_value uuid;
  previous_customer_id uuid;
  source_value text := case when candidate_order_source = 'orders' then 'orders' else 'store_orders' end;
begin
  clean_store_id := public.resolve_customer_store_id(candidate_store_id, candidate_store_instance_id);
  clean_workspace_id := public.resolve_customer_workspace_id(candidate_workspace_id, candidate_store_id, candidate_store_instance_id);
  clean_store_instance_id := public.resolve_customer_store_instance_id(clean_store_id, candidate_store_instance_id);

  if clean_store_id is null
    or clean_workspace_id is null
    or candidate_order_id is null
    or (clean_normalized_phone is null and clean_email is null)
  then
    return null;
  end if;

  select customers.id
  into customer_id_value
  from public.customers customers
  where customers.workspace_id = clean_workspace_id
    and customers.store_id = clean_store_id
    and (
      (clean_normalized_phone is not null and customers.normalized_phone = clean_normalized_phone)
      or (clean_email is not null and customers.normalized_email = clean_email)
    )
  order by
    case when clean_normalized_phone is not null and customers.normalized_phone = clean_normalized_phone then 0 else 1 end,
    customers.updated_at desc
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
      0,
      0,
      null,
      null,
      null,
      jsonb_build_object('source', 'order')
    )
    returning id into customer_id_value;
  else
    update public.customers customers
    set
      name = coalesce(nullif(customers.name, ''), clean_name, 'Customer'),
      phone = coalesce(customers.phone, clean_phone),
      email = coalesce(customers.email, clean_email),
      store_id = clean_store_id,
      store_instance_id = coalesce(
        public.resolve_customer_store_instance_id(customers.store_id, customers.store_instance_id),
        clean_store_instance_id
      ),
      updated_at = now()
    where customers.id = customer_id_value;
  end if;

  select links.customer_id
  into previous_customer_id
  from public.customer_order_links links
  where links.order_source = source_value
    and links.order_id = candidate_order_id
  limit 1;

  insert into public.customer_order_links (
    customer_id,
    workspace_id,
    store_id,
    order_source,
    order_id,
    order_status,
    order_total,
    order_created_at
  )
  values (
    customer_id_value,
    clean_workspace_id,
    clean_store_id,
    source_value,
    candidate_order_id,
    candidate_order_status,
    coalesce(candidate_total, 0),
    coalesce(candidate_created_at, now())
  )
  on conflict (order_source, order_id)
  do update set
    customer_id = excluded.customer_id,
    workspace_id = excluded.workspace_id,
    store_id = excluded.store_id,
    order_status = excluded.order_status,
    order_total = excluded.order_total,
    order_created_at = excluded.order_created_at,
    updated_at = now();

  perform public.recompute_customer_order_totals(customer_id_value);

  if previous_customer_id is not null and previous_customer_id <> customer_id_value then
    perform public.recompute_customer_order_totals(previous_customer_id);
  end if;

  return customer_id_value;
end;
$$;

grant execute on function public.recompute_customer_order_totals(uuid) to authenticated;
grant execute on function public.upsert_store_customer_from_order(uuid, uuid, uuid, uuid, text, text, text, numeric, text, timestamptz, text) to authenticated;

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
language sql
security definer
set search_path = public
as $$
  select public.upsert_store_customer_from_order(
    candidate_workspace_id,
    candidate_store_id,
    candidate_store_instance_id,
    candidate_order_id,
    candidate_name,
    candidate_phone,
    candidate_email,
    candidate_total,
    candidate_order_status,
    candidate_created_at,
    'store_orders'
  );
$$;

grant execute on function public.upsert_store_customer_from_order(uuid, uuid, uuid, uuid, text, text, text, numeric, text, timestamptz) to authenticated;

create or replace function public.sync_store_order_customer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
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
      new.created_at,
      'store_orders'
    );
  exception
    when others then
      raise warning 'store_orders customer sync skipped for order %: %', new.id, sqlerrm;
  end;

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
      new.created_at,
      'orders'
    );
  exception
    when others then
      raise warning 'orders customer sync skipped for order %: %', new.id, sqlerrm;
  end;

  return new;
end;
$$;

do $$
begin
  if to_regclass('public.store_orders') is not null then
    drop trigger if exists store_orders_customer_sync on public.store_orders;
    create trigger store_orders_customer_sync
    after insert or update of customer_name, customer_phone, customer_email, total, order_status, store_id, store_instance_id, workspace_id
    on public.store_orders
    for each row execute function public.sync_store_order_customer();
  end if;

  if to_regclass('public.orders') is not null then
    drop trigger if exists orders_customer_sync on public.orders;
    create trigger orders_customer_sync
    after insert or update of customer_name, customer_phone, customer_email, total, order_status, store_id, store_instance_id, workspace_id
    on public.orders
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
          order_row.created_at,
          'store_orders'
        );
      exception
        when others then
          raise warning 'store_orders customer backfill skipped for order %: %', order_row.id, sqlerrm;
      end;
    end loop;
  end if;

  if to_regclass('public.orders') is not null then
    for order_row in
      select id, workspace_id, store_id, store_instance_id, customer_name, customer_phone, customer_email, total, order_status, created_at
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
          order_row.created_at,
          'orders'
        );
      exception
        when others then
          raise warning 'orders customer backfill skipped for order %: %', order_row.id, sqlerrm;
      end;
    end loop;
  end if;
end $$;
