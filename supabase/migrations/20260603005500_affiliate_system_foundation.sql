-- Affiliate system foundation.
-- Additive only: store affiliate partners, visits, referred orders, and commission status.

create table if not exists public.store_affiliates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  email text not null,
  normalized_email text not null,
  code text not null,
  commission_rate numeric(5, 2) not null default 0 check (commission_rate >= 0 and commission_rate <= 100),
  status text not null default 'active' check (status in ('active', 'disabled')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.store_affiliate_visits (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  store_id uuid not null references public.stores(id) on delete cascade,
  affiliate_id uuid not null references public.store_affiliates(id) on delete cascade,
  affiliate_code text not null,
  landing_path text,
  visitor_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.store_affiliate_orders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  store_id uuid not null references public.stores(id) on delete cascade,
  affiliate_id uuid not null references public.store_affiliates(id) on delete cascade,
  affiliate_code text not null,
  order_source text not null check (order_source in ('orders', 'store_orders')),
  order_id uuid not null,
  order_total numeric(12, 2) not null default 0 check (order_total >= 0),
  commission_rate numeric(5, 2) not null default 0 check (commission_rate >= 0 and commission_rate <= 100),
  commission_amount numeric(12, 2) not null default 0 check (commission_amount >= 0),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'paid')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.store_orders
  add column if not exists affiliate_id uuid references public.store_affiliates(id) on delete set null,
  add column if not exists affiliate_code text;

alter table if exists public.orders
  add column if not exists affiliate_id uuid references public.store_affiliates(id) on delete set null,
  add column if not exists affiliate_code text;

create unique index if not exists store_affiliates_store_code_unique_idx
on public.store_affiliates(store_id, lower(code));

create unique index if not exists store_affiliates_store_email_unique_idx
on public.store_affiliates(store_id, normalized_email);

create index if not exists store_affiliates_workspace_store_idx
on public.store_affiliates(workspace_id, store_id, status, created_at desc);

create index if not exists store_affiliate_visits_workspace_store_idx
on public.store_affiliate_visits(workspace_id, store_id, affiliate_id, created_at desc);

create index if not exists store_affiliate_orders_workspace_store_status_idx
on public.store_affiliate_orders(workspace_id, store_id, status, created_at desc);

create index if not exists store_affiliate_orders_affiliate_idx
on public.store_affiliate_orders(workspace_id, store_id, affiliate_id, created_at desc);

create unique index if not exists store_affiliate_orders_order_unique_idx
on public.store_affiliate_orders(store_id, order_source, order_id);

create index if not exists store_orders_affiliate_id_idx
on public.store_orders(affiliate_id)
where affiliate_id is not null;

create index if not exists orders_affiliate_id_idx
on public.orders(affiliate_id)
where affiliate_id is not null;

create or replace function public.set_store_affiliates_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.code = upper(trim(new.code));
  new.email = lower(trim(new.email));
  new.normalized_email = lower(trim(new.email));
  return new;
end;
$$;

drop trigger if exists store_affiliates_updated_at on public.store_affiliates;
create trigger store_affiliates_updated_at
before insert or update on public.store_affiliates
for each row execute function public.set_store_affiliates_updated_at();

create or replace function public.set_store_affiliate_orders_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.affiliate_code = upper(trim(new.affiliate_code));
  return new;
end;
$$;

drop trigger if exists store_affiliate_orders_updated_at on public.store_affiliate_orders;
create trigger store_affiliate_orders_updated_at
before insert or update on public.store_affiliate_orders
for each row execute function public.set_store_affiliate_orders_updated_at();

alter table public.store_affiliates enable row level security;
alter table public.store_affiliate_visits enable row level security;
alter table public.store_affiliate_orders enable row level security;

drop policy if exists "workspace members read affiliates" on public.store_affiliates;
drop policy if exists "workspace editors write affiliates" on public.store_affiliates;
drop policy if exists "workspace members read affiliate visits" on public.store_affiliate_visits;
drop policy if exists "workspace editors write affiliate visits" on public.store_affiliate_visits;
drop policy if exists "workspace members read affiliate orders" on public.store_affiliate_orders;
drop policy if exists "workspace editors write affiliate orders" on public.store_affiliate_orders;

create policy "workspace members read affiliates"
on public.store_affiliates for select to authenticated
using (public.can_access_workspace(workspace_id));

create policy "workspace editors write affiliates"
on public.store_affiliates for all to authenticated
using (public.workspace_can_edit(workspace_id))
with check (public.workspace_can_edit(workspace_id));

create policy "workspace members read affiliate visits"
on public.store_affiliate_visits for select to authenticated
using (public.can_access_workspace(workspace_id));

create policy "workspace editors write affiliate visits"
on public.store_affiliate_visits for all to authenticated
using (public.workspace_can_edit(workspace_id))
with check (public.workspace_can_edit(workspace_id));

create policy "workspace members read affiliate orders"
on public.store_affiliate_orders for select to authenticated
using (public.can_access_workspace(workspace_id));

create policy "workspace editors write affiliate orders"
on public.store_affiliate_orders for all to authenticated
using (public.workspace_can_edit(workspace_id))
with check (public.workspace_can_edit(workspace_id));
