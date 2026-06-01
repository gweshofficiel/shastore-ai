-- Back-in-stock notification foundation.
-- Additive only: store/product-scoped customer requests without changing product CRUD, checkout, or email delivery.

create table if not exists public.store_back_in_stock_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid,
  store_id uuid not null references public.stores(id) on delete cascade,
  product_id uuid not null references public.store_products(id) on delete cascade,
  customer_email text not null,
  notification_status text not null default 'pending'
    check (notification_status in ('pending', 'notified', 'cancelled')),
  notified_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, product_id, customer_email)
);

create index if not exists store_back_in_stock_requests_store_status_idx
on public.store_back_in_stock_requests(store_id, notification_status, created_at desc);

create index if not exists store_back_in_stock_requests_workspace_idx
on public.store_back_in_stock_requests(workspace_id, store_id, created_at desc);

create index if not exists store_back_in_stock_requests_product_idx
on public.store_back_in_stock_requests(product_id, notification_status, created_at desc);

alter table public.store_back_in_stock_requests enable row level security;

drop policy if exists "workspace members read back in stock requests" on public.store_back_in_stock_requests;
drop policy if exists "workspace editors manage back in stock requests" on public.store_back_in_stock_requests;

create policy "workspace members read back in stock requests"
on public.store_back_in_stock_requests
for select
to authenticated
using (workspace_id is not null and public.can_access_workspace(workspace_id));

create policy "workspace editors manage back in stock requests"
on public.store_back_in_stock_requests
for all
to authenticated
using (workspace_id is not null and public.workspace_can_edit(workspace_id))
with check (workspace_id is not null and public.workspace_can_edit(workspace_id));
