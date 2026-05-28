-- Store coupons foundation.
-- Additive only: store/workspace-scoped coupons and order discount persistence.

create extension if not exists "pgcrypto";

create table if not exists public.store_coupons (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  workspace_id uuid not null,
  code text not null,
  discount_type text not null check (discount_type in ('percentage', 'fixed')),
  discount_value numeric(12, 2) not null check (discount_value > 0),
  status text not null default 'active' check (status in ('active', 'inactive')),
  usage_limit integer check (usage_limit is null or usage_limit >= 0),
  used_count integer not null default 0 check (used_count >= 0),
  minimum_order_amount numeric(12, 2) not null default 0 check (minimum_order_amount >= 0),
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at >= starts_at)
);

create unique index if not exists store_coupons_store_code_unique_idx
on public.store_coupons(store_id, lower(code));

create index if not exists store_coupons_workspace_store_idx
on public.store_coupons(workspace_id, store_id, created_at desc);

create index if not exists store_coupons_store_status_idx
on public.store_coupons(store_id, status, starts_at, ends_at);

alter table public.store_coupons enable row level security;

drop policy if exists "workspace members read store coupons" on public.store_coupons;
create policy "workspace members read store coupons"
on public.store_coupons
for select
to authenticated
using (public.can_access_workspace(workspace_id));

drop policy if exists "workspace managers write store coupons" on public.store_coupons;
create policy "workspace managers write store coupons"
on public.store_coupons
for all
to authenticated
using (public.workspace_can_edit(workspace_id))
with check (public.workspace_can_edit(workspace_id));

create or replace function public.set_store_coupons_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.code = upper(trim(new.code));
  return new;
end;
$$;

drop trigger if exists store_coupons_updated_at on public.store_coupons;
create trigger store_coupons_updated_at
before insert or update on public.store_coupons
for each row execute function public.set_store_coupons_updated_at();

alter table if exists public.store_orders
  add column if not exists coupon_id uuid references public.store_coupons(id) on delete set null,
  add column if not exists coupon_code text,
  add column if not exists discount_type text,
  add column if not exists discount_value numeric(12, 2),
  add column if not exists discount_amount numeric(12, 2) not null default 0,
  add column if not exists order_subtotal_before_discount numeric(12, 2);

alter table if exists public.orders
  add column if not exists coupon_id uuid references public.store_coupons(id) on delete set null,
  add column if not exists coupon_code text,
  add column if not exists discount_type text,
  add column if not exists discount_value numeric(12, 2),
  add column if not exists discount_amount numeric(12, 2) not null default 0,
  add column if not exists order_subtotal_before_discount numeric(12, 2);

create index if not exists store_orders_coupon_id_idx
on public.store_orders(coupon_id)
where coupon_id is not null;

create index if not exists orders_coupon_id_idx
on public.orders(coupon_id)
where coupon_id is not null;

create or replace function public.increment_store_coupon_usage(coupon_id_input uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer;
begin
  update public.store_coupons
  set used_count = used_count + 1,
      updated_at = now()
  where id = coupon_id_input
    and status = 'active'
    and (usage_limit is null or used_count < usage_limit)
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at >= now())
  returning used_count into updated_count;

  return updated_count is not null;
end;
$$;

grant execute on function public.increment_store_coupon_usage(uuid) to authenticated;
