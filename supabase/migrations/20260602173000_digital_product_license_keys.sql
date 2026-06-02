-- Digital product license keys.
-- Additive only: preserves products, checkout, orders, downloads, permissions, and RLS.

create table if not exists public.store_product_license_keys (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid,
  store_id uuid not null references public.stores(id) on delete cascade,
  product_id uuid not null references public.store_products(id) on delete cascade,
  key_value text not null,
  status text not null default 'available',
  assigned_order_id text,
  assigned_order_source text,
  assigned_customer_email text,
  assigned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint store_product_license_keys_status_check
    check (status in ('available', 'assigned', 'revoked')),
  constraint store_product_license_keys_order_source_check
    check (assigned_order_source is null or assigned_order_source in ('orders', 'store_orders')),
  constraint store_product_license_keys_assignment_check
    check (
      status <> 'assigned'
      or (assigned_order_id is not null and assigned_customer_email is not null and assigned_at is not null)
    )
);

create unique index if not exists store_product_license_keys_product_value_unique_idx
on public.store_product_license_keys(product_id, key_value);

create index if not exists store_product_license_keys_product_status_idx
on public.store_product_license_keys(workspace_id, store_id, product_id, status, created_at);

create index if not exists store_product_license_keys_assignment_idx
on public.store_product_license_keys(store_id, assigned_order_source, assigned_order_id, assigned_customer_email)
where status = 'assigned';

alter table public.store_product_license_keys enable row level security;

drop policy if exists "workspace members read license keys" on public.store_product_license_keys;
drop policy if exists "workspace editors manage license keys" on public.store_product_license_keys;
drop policy if exists "service role manages license keys" on public.store_product_license_keys;

create policy "workspace members read license keys"
on public.store_product_license_keys
for select
to authenticated
using (public.can_access_workspace(workspace_id));

create policy "workspace editors manage license keys"
on public.store_product_license_keys
for all
to authenticated
using (public.workspace_can_edit(workspace_id))
with check (public.workspace_can_edit(workspace_id));

create policy "service role manages license keys"
on public.store_product_license_keys
for all
to service_role
using (true)
with check (true);

grant select, insert, update on public.store_product_license_keys to authenticated;
grant all on public.store_product_license_keys to service_role;

create or replace function public.assign_store_product_license_key(
  candidate_product_id uuid,
  candidate_order_id text,
  candidate_order_source text,
  candidate_customer_email text
)
returns table (
  id uuid,
  key_value text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if candidate_product_id is null
    or nullif(candidate_order_id, '') is null
    or candidate_order_source not in ('orders', 'store_orders')
    or nullif(candidate_customer_email, '') is null then
    return;
  end if;

  return query
  with selected_key as (
    select license_keys.id
    from public.store_product_license_keys license_keys
    where license_keys.product_id = candidate_product_id
      and license_keys.status = 'available'
    order by license_keys.created_at asc, license_keys.id asc
    for update skip locked
    limit 1
  )
  update public.store_product_license_keys license_keys
  set
    status = 'assigned',
    assigned_order_id = candidate_order_id,
    assigned_order_source = candidate_order_source,
    assigned_customer_email = candidate_customer_email,
    assigned_at = now(),
    updated_at = now()
  from selected_key
  where license_keys.id = selected_key.id
  returning license_keys.id, license_keys.key_value;
end;
$$;

grant execute on function public.assign_store_product_license_key(uuid, text, text, text) to service_role;
