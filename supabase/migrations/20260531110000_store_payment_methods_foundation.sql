create extension if not exists "pgcrypto";

create table if not exists public.store_payment_methods (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  workspace_id uuid not null,
  method text not null
    check (method in ('cod', 'whatsapp', 'paypal', 'youcan_pay')),
  is_enabled boolean not null default false,
  display_name text,
  instructions text,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, method)
);

create index if not exists store_payment_methods_store_enabled_idx
on public.store_payment_methods(store_id, is_enabled, method);

create index if not exists store_payment_methods_workspace_store_idx
on public.store_payment_methods(workspace_id, store_id);

alter table public.store_payment_methods enable row level security;

drop policy if exists "workspace members read own store payment methods" on public.store_payment_methods;
drop policy if exists "workspace editors manage own store payment methods" on public.store_payment_methods;
drop policy if exists "public reads enabled store payment methods" on public.store_payment_methods;
drop policy if exists "service role manages store payment methods" on public.store_payment_methods;

create policy "workspace members read own store payment methods"
on public.store_payment_methods
for select
to authenticated
using (public.can_access_workspace(workspace_id));

create policy "workspace editors manage own store payment methods"
on public.store_payment_methods
for all
to authenticated
using (public.workspace_can_edit(workspace_id))
with check (public.workspace_can_edit(workspace_id));

create policy "public reads enabled store payment methods"
on public.store_payment_methods
for select
to anon, authenticated
using (
  is_enabled = true
  and exists (
    select 1
    from public.published_stores published
    where published.store_id = store_payment_methods.store_id
      and coalesce(published.status, 'published') = 'published'
      and coalesce(published.visibility, 'public') = 'public'
  )
);

create policy "service role manages store payment methods"
on public.store_payment_methods
for all
to service_role
using (true)
with check (true);

grant select, insert, update, delete on public.store_payment_methods to authenticated;
grant select on public.store_payment_methods to anon;
grant all on public.store_payment_methods to service_role;
