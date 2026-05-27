-- Store orders workspace / store instance schema recovery.
-- Additive only: restores columns required by dashboard order status and timeline flows.
-- Does not reset data, drop columns, or change payment processors.

alter table if exists public.store_orders
  add column if not exists workspace_id uuid,
  add column if not exists store_instance_id uuid;

-- Backfill workspace_id from store ownership and publication context.
do $$
begin
  if to_regclass('public.store_orders') is null or to_regclass('public.stores') is null then
    return;
  end if;

  update public.store_orders orders
  set workspace_id = coalesce(
    orders.workspace_id,
    stores.workspace_id,
    orders.owner_user_id,
    orders.user_id
  )
  from public.stores stores
  where orders.store_id = stores.id
    and orders.workspace_id is null;

  if to_regclass('public.published_stores') is not null then
    update public.store_orders orders
    set workspace_id = coalesce(orders.workspace_id, published.workspace_id, stores.workspace_id)
    from public.stores stores
    left join public.published_stores published on published.store_id = stores.id
    where orders.store_id = stores.id
      and orders.workspace_id is null;
  end if;
end $$;

-- Store-mode default: published store id is the runtime instance id.
update public.store_orders orders
set store_instance_id = coalesce(orders.store_instance_id, orders.store_id)
where orders.store_instance_id is null
  and orders.store_id is not null;

-- Legacy store_instances mapping when that table exists (id-aligned rows only).
do $$
begin
  if to_regclass('public.store_instances') is null or to_regclass('public.stores') is null then
    return;
  end if;

  update public.store_orders orders
  set store_instance_id = coalesce(orders.store_instance_id, instances.id)
  from public.stores stores
  join public.store_instances instances on instances.id = stores.id
  where orders.store_id = stores.id
    and orders.store_instance_id is null;
exception
  when others then
    raise notice 'store_orders store_instances backfill skipped: %', sqlerrm;
end $$;

-- Optional FK: mirror public.orders (store_instance_id -> stores.id).
do $$
begin
  if to_regclass('public.store_orders') is null or to_regclass('public.stores') is null then
    return;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.store_orders'::regclass
      and contype = 'f'
      and conname = 'store_orders_store_instance_id_fkey'
  ) then
    alter table public.store_orders
      add constraint store_orders_store_instance_id_fkey
      foreign key (store_instance_id) references public.stores(id) on delete cascade;
  end if;
exception
  when others then
    raise notice 'store_orders store_instance_id FK skipped: %', sqlerrm;
end $$;

create index if not exists store_orders_workspace_id_idx
on public.store_orders(workspace_id);

create index if not exists store_orders_store_instance_id_idx
on public.store_orders(store_instance_id);
