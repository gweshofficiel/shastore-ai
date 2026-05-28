-- Store inventory foundation.
-- Additive only: product stock fields and atomic inventory movements for order confirmation.

alter table if exists public.store_products
  add column if not exists stock_quantity integer not null default 0 check (stock_quantity >= 0),
  add column if not exists track_inventory boolean not null default false,
  add column if not exists low_stock_threshold integer check (low_stock_threshold is null or low_stock_threshold >= 0),
  add column if not exists inventory_status text not null default 'in_stock'
    check (inventory_status in ('in_stock', 'out_of_stock'));

update public.store_products
set inventory_status = case
  when track_inventory and stock_quantity <= 0 then 'out_of_stock'
  else 'in_stock'
end
where inventory_status is null
   or inventory_status not in ('in_stock', 'out_of_stock')
   or (track_inventory and stock_quantity <= 0 and inventory_status <> 'out_of_stock')
   or ((not track_inventory or stock_quantity > 0) and inventory_status <> 'in_stock');

create index if not exists store_products_inventory_idx
on public.store_products(workspace_id, store_id, track_inventory, inventory_status);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid,
  store_id uuid not null references public.stores(id) on delete cascade,
  product_id uuid not null references public.store_products(id) on delete cascade,
  order_source text not null check (order_source in ('orders', 'store_orders')),
  order_id uuid not null,
  movement_type text not null check (movement_type in ('decrement', 'restock')),
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now(),
  unique (order_source, order_id, product_id, movement_type)
);

create index if not exists inventory_movements_store_created_idx
on public.inventory_movements(workspace_id, store_id, created_at desc);

alter table public.inventory_movements enable row level security;

drop policy if exists "workspace members read inventory movements" on public.inventory_movements;
create policy "workspace members read inventory movements"
on public.inventory_movements
for select
to authenticated
using (public.can_access_workspace(workspace_id));

drop policy if exists "workspace managers write inventory movements" on public.inventory_movements;
create policy "workspace managers write inventory movements"
on public.inventory_movements
for all
to authenticated
using (public.workspace_can_edit(workspace_id))
with check (public.workspace_can_edit(workspace_id));

create or replace function public.apply_order_inventory_movement(
  candidate_order_source text,
  candidate_order_id uuid,
  candidate_direction text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  order_row record;
  item_row record;
  product_row record;
  movement_exists boolean;
  normalized_source text := case when candidate_order_source = 'orders' then 'orders' else 'store_orders' end;
  normalized_direction text := case when candidate_direction = 'restock' then 'restock' else 'decrement' end;
  order_items_json jsonb := '[]'::jsonb;
begin
  if candidate_order_id is null then
    return false;
  end if;

  if normalized_source = 'orders' then
    select id, store_id, workspace_id
    into order_row
    from public.orders
    where id = candidate_order_id;
  else
    select id, store_id, workspace_id, items
    into order_row
    from public.store_orders
    where id = candidate_order_id;
  end if;

  if order_row.id is null or order_row.store_id is null then
    return false;
  end if;

  if normalized_source = 'store_orders' then
    order_items_json := coalesce(order_row.items, '[]'::jsonb);
  end if;

  if normalized_direction = 'decrement' then
    select exists (
      select 1
      from public.inventory_movements movements
      where movements.order_source = normalized_source
        and movements.order_id = candidate_order_id
        and movements.movement_type = 'decrement'
    )
    into movement_exists;

    if movement_exists then
      return true;
    end if;

    for item_row in
      select *
      from (
        select
          items.product_id as product_id,
          sum(items.quantity)::integer as quantity
        from public.order_items items
        where normalized_source = 'orders'
          and items.order_id = candidate_order_id
          and items.product_id is not null
        group by items.product_id
        union all
        select
          case
            when coalesce(item->>'product_id', item->>'id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              then coalesce(item->>'product_id', item->>'id')::uuid
            else null
          end as product_id,
          sum(greatest(
            coalesce(
              case when coalesce(item->>'quantity', '') ~ '^[0-9]+$' then (item->>'quantity')::integer end,
              1
            ),
            1
          ))::integer as quantity
        from jsonb_array_elements(
          case
            when normalized_source = 'store_orders' and jsonb_typeof(order_items_json) = 'array'
              then order_items_json
            else '[]'::jsonb
          end
        ) item
        where nullif(coalesce(item->>'product_id', item->>'id'), '') is not null
        group by case
          when coalesce(item->>'product_id', item->>'id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            then coalesce(item->>'product_id', item->>'id')::uuid
          else null
        end
      ) order_items
      where order_items.product_id is not null
    loop
      select id, stock_quantity, track_inventory
      into product_row
      from public.store_products
      where id = item_row.product_id
        and store_id = order_row.store_id
      for update;

      if product_row.id is not null
        and product_row.track_inventory
        and product_row.stock_quantity < item_row.quantity
      then
        return false;
      end if;
    end loop;

    for item_row in
      select *
      from (
        select
          items.product_id as product_id,
          sum(items.quantity)::integer as quantity
        from public.order_items items
        where normalized_source = 'orders'
          and items.order_id = candidate_order_id
          and items.product_id is not null
        group by items.product_id
        union all
        select
          case
            when coalesce(item->>'product_id', item->>'id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              then coalesce(item->>'product_id', item->>'id')::uuid
            else null
          end as product_id,
          sum(greatest(
            coalesce(
              case when coalesce(item->>'quantity', '') ~ '^[0-9]+$' then (item->>'quantity')::integer end,
              1
            ),
            1
          ))::integer as quantity
        from jsonb_array_elements(
          case
            when normalized_source = 'store_orders' and jsonb_typeof(order_items_json) = 'array'
              then order_items_json
            else '[]'::jsonb
          end
        ) item
        where nullif(coalesce(item->>'product_id', item->>'id'), '') is not null
        group by case
          when coalesce(item->>'product_id', item->>'id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            then coalesce(item->>'product_id', item->>'id')::uuid
          else null
        end
      ) order_items
      where order_items.product_id is not null
    loop
      update public.store_products products
      set
        stock_quantity = products.stock_quantity - item_row.quantity,
        inventory_status = case
          when products.stock_quantity - item_row.quantity <= 0 then 'out_of_stock'
          else 'in_stock'
        end,
        updated_at = now()
      where products.id = item_row.product_id
        and products.store_id = order_row.store_id
        and products.track_inventory = true;

      insert into public.inventory_movements (
        workspace_id,
        store_id,
        product_id,
        order_source,
        order_id,
        movement_type,
        quantity
      )
      select
        order_row.workspace_id,
        order_row.store_id,
        item_row.product_id,
        normalized_source,
        candidate_order_id,
        'decrement',
        item_row.quantity
      where exists (
        select 1
        from public.store_products products
        where products.id = item_row.product_id
          and products.store_id = order_row.store_id
          and products.track_inventory = true
      )
      on conflict do nothing;
    end loop;

    return true;
  end if;

  select exists (
    select 1
    from public.inventory_movements movements
    where movements.order_source = normalized_source
      and movements.order_id = candidate_order_id
      and movements.movement_type = 'restock'
  )
  into movement_exists;

  if movement_exists then
    return true;
  end if;

  for item_row in
    select product_id, quantity
    from public.inventory_movements movements
    where movements.order_source = normalized_source
      and movements.order_id = candidate_order_id
      and movements.movement_type = 'decrement'
  loop
    update public.store_products products
    set
      stock_quantity = products.stock_quantity + item_row.quantity,
      inventory_status = 'in_stock',
      updated_at = now()
    where products.id = item_row.product_id
      and products.store_id = order_row.store_id
      and products.track_inventory = true;

    insert into public.inventory_movements (
      workspace_id,
      store_id,
      product_id,
      order_source,
      order_id,
      movement_type,
      quantity
    )
    values (
      order_row.workspace_id,
      order_row.store_id,
      item_row.product_id,
      normalized_source,
      candidate_order_id,
      'restock',
      item_row.quantity
    )
    on conflict do nothing;
  end loop;

  return true;
end;
$$;

grant execute on function public.apply_order_inventory_movement(text, uuid, text) to authenticated;

create or replace function public.sync_order_inventory_on_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  inventory_ok boolean;
  source_table text := tg_table_name;
begin
  if new.order_status = 'confirmed'
    and coalesce(old.order_status, '') <> 'confirmed'
  then
    inventory_ok := public.apply_order_inventory_movement(source_table, new.id, 'decrement');

    if not inventory_ok then
      raise exception 'insufficient inventory for order %', new.id
        using errcode = '23514';
    end if;
  end if;

  if new.order_status in ('cancelled', 'canceled')
    and coalesce(old.order_status, '') = 'confirmed'
  then
    perform public.apply_order_inventory_movement(source_table, new.id, 'restock');
  end if;

  return new;
end;
$$;

drop trigger if exists sync_store_orders_inventory_on_status_change on public.store_orders;
create trigger sync_store_orders_inventory_on_status_change
after update of order_status on public.store_orders
for each row
execute function public.sync_order_inventory_on_status_change();

drop trigger if exists sync_orders_inventory_on_status_change on public.orders;
create trigger sync_orders_inventory_on_status_change
after update of order_status on public.orders
for each row
execute function public.sync_order_inventory_on_status_change();
