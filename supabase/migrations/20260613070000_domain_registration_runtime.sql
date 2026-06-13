-- Domain registration runtime.
-- Additive only: records provider AddOrder attempts without changing DNS, SSL, or billing tables.

create extension if not exists "pgcrypto";

create table if not exists public.domain_orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  domain_name text not null,
  tld text not null,
  provider text not null default 'httpapi',
  provider_order_id text,
  provider_entity_id text,
  registration_years integer not null default 1,
  status text not null default 'draft',
  raw_response jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'domain_orders_status_check'
      and conrelid = 'public.domain_orders'::regclass
  ) then
    alter table public.domain_orders
      add constraint domain_orders_status_check
      check (status in ('draft', 'submitted', 'pending', 'active', 'failed'));
  end if;
end $$;

create index if not exists domain_orders_store_created_idx
on public.domain_orders(store_id, created_at desc);

create index if not exists domain_orders_domain_name_idx
on public.domain_orders(lower(domain_name));

create index if not exists domain_orders_provider_order_idx
on public.domain_orders(provider, provider_order_id)
where provider_order_id is not null;

alter table public.domain_orders enable row level security;

drop policy if exists "store members read domain orders" on public.domain_orders;
create policy "store members read domain orders"
on public.domain_orders
for select
to authenticated
using (public.can_access_store_instance(store_id));

drop policy if exists "store managers write domain orders" on public.domain_orders;
create policy "store managers write domain orders"
on public.domain_orders
for all
to authenticated
using (public.can_manage_store_instance(store_id))
with check (public.can_manage_store_instance(store_id));

drop policy if exists "service role can manage domain orders" on public.domain_orders;
create policy "service role can manage domain orders"
on public.domain_orders
for all
to service_role
using (true)
with check (true);
