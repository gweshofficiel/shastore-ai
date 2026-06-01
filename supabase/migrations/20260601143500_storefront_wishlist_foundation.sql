-- Storefront wishlist foundation.
-- Additive only: store/session scoped favorites without changing cart, checkout, products, or customers.

create table if not exists public.store_wishlist_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid,
  store_id uuid not null references public.stores(id) on delete cascade,
  product_id uuid not null references public.store_products(id) on delete cascade,
  session_id text not null,
  customer_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, session_id, product_id)
);

create index if not exists store_wishlist_items_store_session_idx
on public.store_wishlist_items(store_id, session_id, created_at desc);

create index if not exists store_wishlist_items_workspace_idx
on public.store_wishlist_items(workspace_id, store_id, created_at desc);

alter table public.store_wishlist_items enable row level security;

drop policy if exists "workspace members read store wishlist items" on public.store_wishlist_items;
drop policy if exists "workspace editors manage store wishlist items" on public.store_wishlist_items;

create policy "workspace members read store wishlist items"
on public.store_wishlist_items
for select
to authenticated
using (workspace_id is not null and public.can_access_workspace(workspace_id));

create policy "workspace editors manage store wishlist items"
on public.store_wishlist_items
for all
to authenticated
using (workspace_id is not null and public.workspace_can_edit(workspace_id))
with check (workspace_id is not null and public.workspace_can_edit(workspace_id));
