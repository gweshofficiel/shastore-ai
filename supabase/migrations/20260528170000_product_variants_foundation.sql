-- Product variants foundation.
-- Additive only: variants are optional and products without variants keep current behavior.

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.store_products(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  workspace_id uuid,
  name text not null,
  option_size text,
  option_color text,
  option_material text,
  option_custom_name text,
  option_custom_value text,
  sku text,
  price_override numeric(12, 2) check (price_override is null or price_override >= 0),
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.product_variants
  add column if not exists product_id uuid references public.store_products(id) on delete cascade,
  add column if not exists store_id uuid references public.stores(id) on delete cascade,
  add column if not exists workspace_id uuid,
  add column if not exists name text,
  add column if not exists option_size text,
  add column if not exists option_color text,
  add column if not exists option_material text,
  add column if not exists option_custom_name text,
  add column if not exists option_custom_value text,
  add column if not exists sku text,
  add column if not exists price_override numeric(12, 2) check (price_override is null or price_override >= 0),
  add column if not exists stock_quantity integer not null default 0 check (stock_quantity >= 0),
  add column if not exists status text not null default 'active' check (status in ('active', 'inactive')),
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update public.product_variants variants
set workspace_id = coalesce(variants.workspace_id, products.workspace_id)
from public.store_products products
where products.id = variants.product_id
  and variants.workspace_id is null;

create index if not exists product_variants_product_status_idx
on public.product_variants(product_id, status, updated_at desc);

create index if not exists product_variants_workspace_store_idx
on public.product_variants(workspace_id, store_id, product_id);

create unique index if not exists product_variants_product_sku_unique_idx
on public.product_variants(product_id, lower(sku))
where sku is not null and sku <> '';

alter table public.product_variants enable row level security;

drop policy if exists "workspace members read product variants" on public.product_variants;
create policy "workspace members read product variants"
on public.product_variants
for select
to authenticated
using (public.can_access_workspace(workspace_id));

drop policy if exists "workspace managers write product variants" on public.product_variants;
create policy "workspace managers write product variants"
on public.product_variants
for all
to authenticated
using (public.workspace_can_edit(workspace_id))
with check (public.workspace_can_edit(workspace_id));

drop policy if exists "public can read active product variants" on public.product_variants;
create policy "public can read active product variants"
on public.product_variants
for select
to anon, authenticated
using (
  status = 'active'
  and exists (
    select 1
    from public.store_products products
    join public.stores stores on stores.id = products.store_id
    left join public.published_stores published on published.store_id = stores.id
    where products.id = product_variants.product_id
      and products.store_id = product_variants.store_id
      and products.status = 'active'
      and stores.status = 'published'
      and coalesce(published.status, 'published') = 'published'
  )
);

alter table if exists public.order_items
  add column if not exists variant_id uuid references public.product_variants(id) on delete set null,
  add column if not exists variant_name text,
  add column if not exists variant_sku text,
  add column if not exists variant_options jsonb not null default '{}'::jsonb;

alter table if exists public.inventory_movements
  add column if not exists variant_id uuid references public.product_variants(id) on delete set null;

alter table if exists public.inventory_movements
  drop constraint if exists inventory_movements_order_source_order_id_product_id_movement_type_key;

create unique index if not exists inventory_movements_order_product_variant_type_idx
on public.inventory_movements(
  order_source,
  order_id,
  product_id,
  coalesce(variant_id, '00000000-0000-0000-0000-000000000000'::uuid),
  movement_type
);

create index if not exists inventory_movements_variant_idx
on public.inventory_movements(variant_id, created_at desc)
where variant_id is not null;

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
  variant_row record;
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
          items.variant_id as variant_id,
          sum(items.quantity)::integer as quantity
        from public.order_items items
        where normalized_source = 'orders'
          and items.order_id = candidate_order_id
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
        group by
          case
            when coalesce(item->>'product_id', item->>'id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              then coalesce(item->>'product_id', item->>'id')::uuid
            else null
          end,
          case
            when coalesce(item->>'variant_id', item->>'variantId', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              then coalesce(item->>'variant_id', item->>'variantId')::uuid
            else null
          end
      ) order_items
      where order_items.product_id is not null
    loop
      if item_row.variant_id is not null then
        select id, stock_quantity, status
        into variant_row
        from public.product_variants
        where id = item_row.variant_id
          and product_id = item_row.product_id
          and store_id = order_row.store_id
        for update;

        if variant_row.id is null
          or variant_row.status <> 'active'
          or variant_row.stock_quantity < item_row.quantity
        then
          return false;
        end if;
      else
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
      end if;
    end loop;

    for item_row in
      select *
      from (
        select
          items.product_id as product_id,
          items.variant_id as variant_id,
          sum(items.quantity)::integer as quantity
        from public.order_items items
        where normalized_source = 'orders'
          and items.order_id = candidate_order_id
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
        group by
          case
            when coalesce(item->>'product_id', item->>'id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              then coalesce(item->>'product_id', item->>'id')::uuid
            else null
          end,
          case
            when coalesce(item->>'variant_id', item->>'variantId', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              then coalesce(item->>'variant_id', item->>'variantId')::uuid
            else null
          end
      ) order_items
      where order_items.product_id is not null
    loop
      if item_row.variant_id is not null then
        update public.product_variants variants
        set
          stock_quantity = variants.stock_quantity - item_row.quantity,
          updated_at = now()
        where variants.id = item_row.variant_id
          and variants.product_id = item_row.product_id
          and variants.store_id = order_row.store_id;
      else
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
      end if;

      insert into public.inventory_movements (
        workspace_id,
        store_id,
        product_id,
        variant_id,
        order_source,
        order_id,
        movement_type,
        quantity
      )
      select
        order_row.workspace_id,
        order_row.store_id,
        item_row.product_id,
        item_row.variant_id,
        normalized_source,
        candidate_order_id,
        'decrement',
        item_row.quantity
      where item_row.variant_id is not null
         or exists (
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
    select product_id, variant_id, quantity
    from public.inventory_movements movements
    where movements.order_source = normalized_source
      and movements.order_id = candidate_order_id
      and movements.movement_type = 'decrement'
  loop
    if item_row.variant_id is not null then
      update public.product_variants variants
      set
        stock_quantity = variants.stock_quantity + item_row.quantity,
        updated_at = now()
      where variants.id = item_row.variant_id
        and variants.product_id = item_row.product_id
        and variants.store_id = order_row.store_id;
    else
      update public.store_products products
      set
        stock_quantity = products.stock_quantity + item_row.quantity,
        inventory_status = 'in_stock',
        updated_at = now()
      where products.id = item_row.product_id
        and products.store_id = order_row.store_id
        and products.track_inventory = true;
    end if;

    insert into public.inventory_movements (
      workspace_id,
      store_id,
      product_id,
      variant_id,
      order_source,
      order_id,
      movement_type,
      quantity
    )
    values (
      order_row.workspace_id,
      order_row.store_id,
      item_row.product_id,
      item_row.variant_id,
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
