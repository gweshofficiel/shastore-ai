-- Real inventory reservations foundation.
-- Additive only: keeps products, inventory, cart, checkout, orders, shipping, and taxes intact.

create table if not exists public.inventory_reservations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid,
  store_id uuid not null references public.stores(id) on delete cascade,
  product_id uuid not null references public.store_products(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete cascade,
  session_id text,
  customer_id uuid,
  order_source text check (order_source is null or order_source in ('orders', 'store_orders')),
  order_id uuid,
  quantity integer not null check (quantity > 0),
  status text not null default 'active' check (status in ('active', 'confirmed', 'expired', 'released')),
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists inventory_reservations_active_lookup_idx
on public.inventory_reservations(store_id, product_id, variant_id, status, expires_at);

create index if not exists inventory_reservations_session_idx
on public.inventory_reservations(store_id, session_id, status, expires_at);

create index if not exists inventory_reservations_order_idx
on public.inventory_reservations(order_source, order_id, status);

alter table public.inventory_reservations enable row level security;

drop policy if exists "workspace members read inventory reservations" on public.inventory_reservations;
drop policy if exists "workspace editors write inventory reservations" on public.inventory_reservations;
drop policy if exists "service role manages inventory reservations" on public.inventory_reservations;

create policy "workspace members read inventory reservations"
on public.inventory_reservations for select to authenticated
using (workspace_id is not null and public.can_access_workspace(workspace_id));

create policy "workspace editors write inventory reservations"
on public.inventory_reservations for all to authenticated
using (workspace_id is not null and public.workspace_can_edit(workspace_id))
with check (workspace_id is not null and public.workspace_can_edit(workspace_id));

create policy "service role manages inventory reservations"
on public.inventory_reservations for all to service_role
using (true)
with check (true);

create or replace function public.expire_inventory_reservations()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  expired_count integer;
begin
  update public.inventory_reservations
  set status = 'expired', updated_at = now()
  where status = 'active'
    and expires_at <= now();

  get diagnostics expired_count = row_count;
  return expired_count;
end;
$$;

create or replace function public.active_inventory_reserved_quantity(
  candidate_store_id uuid,
  candidate_product_id uuid,
  candidate_variant_id uuid default null,
  candidate_excluded_session_id text default null,
  candidate_order_source text default null,
  candidate_order_id uuid default null
)
returns integer
language sql
stable
as $$
  select coalesce(sum(reservations.quantity), 0)::integer
  from public.inventory_reservations reservations
  where reservations.store_id = candidate_store_id
    and reservations.product_id = candidate_product_id
    and (
      (candidate_variant_id is null and reservations.variant_id is null)
      or reservations.variant_id = candidate_variant_id
    )
    and reservations.status = 'active'
    and reservations.expires_at > now()
    and (
      candidate_excluded_session_id is null
      or reservations.session_id is distinct from candidate_excluded_session_id
    )
    and (
      candidate_order_id is null
      or reservations.order_id is distinct from candidate_order_id
      or reservations.order_source is distinct from candidate_order_source
    )
$$;

create or replace function public.reserve_inventory_items(
  candidate_store_id uuid,
  candidate_workspace_id uuid,
  candidate_session_id text,
  candidate_customer_id uuid,
  candidate_items jsonb,
  candidate_expires_in_minutes integer default 30,
  candidate_order_source text default null,
  candidate_order_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  item_row record;
  product_row record;
  variant_row record;
  available_quantity integer;
  expires_at_value timestamptz := now() + make_interval(mins => greatest(coalesce(candidate_expires_in_minutes, 30), 5));
begin
  if candidate_store_id is null or nullif(candidate_session_id, '') is null then
    return false;
  end if;

  perform public.expire_inventory_reservations();

  update public.inventory_reservations
  set status = 'released', updated_at = now()
  where store_id = candidate_store_id
    and session_id = candidate_session_id
    and status = 'active'
    and (
      candidate_order_id is null
      or order_id is distinct from candidate_order_id
      or order_source is distinct from candidate_order_source
    );

  for item_row in
    select
      case
        when coalesce(item->>'product_id', item->>'id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          then coalesce(item->>'product_id', item->>'id')::uuid
        else null
      end as product_id,
      case
        when coalesce(item->>'variant_id', item->>'variantId', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          then coalesce(item->>'variant_id', item->>'variantId')::uuid
        else null
      end as variant_id,
      sum(greatest(coalesce(case when coalesce(item->>'quantity', '') ~ '^[0-9]+$' then (item->>'quantity')::integer end, 1), 1))::integer as quantity
    from jsonb_array_elements(case when jsonb_typeof(candidate_items) = 'array' then candidate_items else '[]'::jsonb end) item
    where nullif(coalesce(item->>'product_id', item->>'id'), '') is not null
    group by 1, 2
  loop
    if item_row.product_id is null then
      return false;
    end if;

    if item_row.variant_id is not null then
      select id, product_id, store_id, status, stock_quantity
      into variant_row
      from public.product_variants
      where id = item_row.variant_id
        and product_id = item_row.product_id
        and store_id = candidate_store_id
      for update;

      available_quantity := coalesce(variant_row.stock_quantity, 0)
        - public.active_inventory_reserved_quantity(candidate_store_id, item_row.product_id, item_row.variant_id, candidate_session_id, candidate_order_source, candidate_order_id);

      if variant_row.id is null
        or variant_row.status <> 'active'
        or available_quantity < item_row.quantity
      then
        return false;
      end if;
    else
      select id, store_id, track_inventory, stock_quantity, inventory_status
      into product_row
      from public.store_products
      where id = item_row.product_id
        and store_id = candidate_store_id
      for update;

      if product_row.id is null then
        return false;
      end if;

      if not coalesce(product_row.track_inventory, false) then
        continue;
      end if;

      available_quantity := coalesce(product_row.stock_quantity, 0)
        - public.active_inventory_reserved_quantity(candidate_store_id, item_row.product_id, null, candidate_session_id, candidate_order_source, candidate_order_id);

      if product_row.inventory_status = 'out_of_stock'
        or available_quantity < item_row.quantity
      then
        return false;
      end if;
    end if;
  end loop;

  for item_row in
    select
      case
        when coalesce(item->>'product_id', item->>'id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          then coalesce(item->>'product_id', item->>'id')::uuid
        else null
      end as product_id,
      case
        when coalesce(item->>'variant_id', item->>'variantId', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          then coalesce(item->>'variant_id', item->>'variantId')::uuid
        else null
      end as variant_id,
      sum(greatest(coalesce(case when coalesce(item->>'quantity', '') ~ '^[0-9]+$' then (item->>'quantity')::integer end, 1), 1))::integer as quantity
    from jsonb_array_elements(case when jsonb_typeof(candidate_items) = 'array' then candidate_items else '[]'::jsonb end) item
    where nullif(coalesce(item->>'product_id', item->>'id'), '') is not null
    group by 1, 2
  loop
    if item_row.variant_id is null then
      select id, track_inventory
      into product_row
      from public.store_products
      where id = item_row.product_id
        and store_id = candidate_store_id;

      if product_row.id is null or not coalesce(product_row.track_inventory, false) then
        continue;
      end if;
    end if;

    insert into public.inventory_reservations (
      workspace_id,
      store_id,
      product_id,
      variant_id,
      session_id,
      customer_id,
      order_source,
      order_id,
      quantity,
      status,
      expires_at
    )
    values (
      candidate_workspace_id,
      candidate_store_id,
      item_row.product_id,
      item_row.variant_id,
      candidate_session_id,
      candidate_customer_id,
      candidate_order_source,
      candidate_order_id,
      item_row.quantity,
      'active',
      expires_at_value
    );
  end loop;

  return true;
end;
$$;

grant execute on function public.expire_inventory_reservations() to authenticated, anon, service_role;
grant execute on function public.active_inventory_reserved_quantity(uuid, uuid, uuid, text, text, uuid) to authenticated, anon, service_role;
grant execute on function public.reserve_inventory_items(uuid, uuid, text, uuid, jsonb, integer, text, uuid) to authenticated, anon, service_role;

create or replace function public.check_order_inventory_reservations_on_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  item_row record;
  product_row record;
  variant_row record;
  order_items_json jsonb := '[]'::jsonb;
  source_table text := tg_table_name;
  available_quantity integer;
begin
  if new.order_status <> 'confirmed'
    or coalesce(old.order_status, '') = 'confirmed'
  then
    return new;
  end if;

  perform public.expire_inventory_reservations();

  if source_table = 'store_orders' then
    order_items_json := coalesce(new.items, '[]'::jsonb);
  end if;

  for item_row in
    select *
    from (
      select
        items.product_id as product_id,
        items.variant_id as variant_id,
        sum(items.quantity)::integer as quantity
      from public.order_items items
      where source_table = 'orders'
        and items.order_id = new.id
        and items.product_id is not null
      group by items.product_id, items.variant_id
      union all
      select
        case
          when coalesce(item->>'product_id', item->>'id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            then coalesce(item->>'product_id', item->>'id')::uuid
          else null
        end as product_id,
        case
          when coalesce(item->>'variant_id', item->>'variantId', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            then coalesce(item->>'variant_id', item->>'variantId')::uuid
          else null
        end as variant_id,
        sum(greatest(coalesce(case when coalesce(item->>'quantity', '') ~ '^[0-9]+$' then (item->>'quantity')::integer end, 1), 1))::integer as quantity
      from jsonb_array_elements(case when source_table = 'store_orders' and jsonb_typeof(order_items_json) = 'array' then order_items_json else '[]'::jsonb end) item
      where nullif(coalesce(item->>'product_id', item->>'id'), '') is not null
      group by 1, 2
    ) order_items
    where order_items.product_id is not null
  loop
    if item_row.variant_id is not null then
      select id, product_id, store_id, status, stock_quantity
      into variant_row
      from public.product_variants
      where id = item_row.variant_id
        and product_id = item_row.product_id
        and store_id = new.store_id
      for update;

      available_quantity := coalesce(variant_row.stock_quantity, 0)
        - public.active_inventory_reserved_quantity(new.store_id, item_row.product_id, item_row.variant_id, null, source_table, new.id);

      if variant_row.id is null
        or variant_row.status <> 'active'
        or available_quantity < item_row.quantity
      then
        raise exception 'insufficient inventory for order %', new.id
          using errcode = '23514';
      end if;
    else
      select id, store_id, track_inventory, stock_quantity, inventory_status
      into product_row
      from public.store_products
      where id = item_row.product_id
        and store_id = new.store_id
      for update;

      if product_row.id is not null and coalesce(product_row.track_inventory, false) then
        available_quantity := coalesce(product_row.stock_quantity, 0)
          - public.active_inventory_reserved_quantity(new.store_id, item_row.product_id, null, null, source_table, new.id);

        if product_row.inventory_status = 'out_of_stock'
          or available_quantity < item_row.quantity
        then
          raise exception 'insufficient inventory for order %', new.id
            using errcode = '23514';
        end if;
      end if;
    end if;
  end loop;

  return new;
end;
$$;

create or replace function public.sync_inventory_reservations_on_order_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  source_table text := tg_table_name;
begin
  if new.order_status = 'confirmed'
    and coalesce(old.order_status, '') <> 'confirmed'
  then
    update public.inventory_reservations
    set status = 'confirmed', updated_at = now()
    where order_source = source_table
      and order_id = new.id
      and status = 'active';
  end if;

  if new.order_status in ('cancelled', 'canceled') then
    update public.inventory_reservations
    set status = 'released', updated_at = now()
    where order_source = source_table
      and order_id = new.id
      and status in ('active', 'confirmed');
  end if;

  return new;
end;
$$;

drop trigger if exists check_store_orders_inventory_reservations_before_status_change on public.store_orders;
create trigger check_store_orders_inventory_reservations_before_status_change
before update of order_status on public.store_orders
for each row
execute function public.check_order_inventory_reservations_on_status_change();

drop trigger if exists check_orders_inventory_reservations_before_status_change on public.orders;
create trigger check_orders_inventory_reservations_before_status_change
before update of order_status on public.orders
for each row
execute function public.check_order_inventory_reservations_on_status_change();

drop trigger if exists sync_store_orders_inventory_reservations_on_status_change on public.store_orders;
create trigger sync_store_orders_inventory_reservations_on_status_change
after update of order_status on public.store_orders
for each row
execute function public.sync_inventory_reservations_on_order_status_change();

drop trigger if exists sync_orders_inventory_reservations_on_status_change on public.orders;
create trigger sync_orders_inventory_reservations_on_status_change
after update of order_status on public.orders
for each row
execute function public.sync_inventory_reservations_on_order_status_change();
