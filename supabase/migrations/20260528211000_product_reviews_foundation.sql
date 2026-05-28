-- Product reviews and ratings foundation for SHASTORE AI.
-- Additive only: store/product scoped reviews with moderation enabled by default.

create table if not exists public.product_reviews (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  store_id uuid not null references public.stores(id) on delete cascade,
  product_id uuid not null references public.store_products(id) on delete cascade,
  order_id uuid,
  customer_name text not null,
  customer_phone text,
  rating integer not null check (rating between 1 and 5),
  title text,
  comment text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  moderation_note text,
  moderated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists product_reviews_store_status_idx
  on public.product_reviews(workspace_id, store_id, status, created_at desc);

create index if not exists product_reviews_product_status_idx
  on public.product_reviews(store_id, product_id, status, created_at desc);

create index if not exists product_reviews_order_idx
  on public.product_reviews(store_id, order_id);

alter table public.product_reviews enable row level security;

drop policy if exists "workspace members read product reviews" on public.product_reviews;
drop policy if exists "workspace editors moderate product reviews" on public.product_reviews;
drop policy if exists "public can read approved product reviews" on public.product_reviews;

create policy "workspace members read product reviews"
on public.product_reviews for select to authenticated
using (public.can_access_workspace(workspace_id));

create policy "workspace editors moderate product reviews"
on public.product_reviews for all to authenticated
using (public.workspace_can_edit(workspace_id))
with check (public.workspace_can_edit(workspace_id));

create policy "public can read approved product reviews"
on public.product_reviews for select to anon, authenticated
using (
  status = 'approved'
  and exists (
    select 1 from public.stores stores
    where stores.id = product_reviews.store_id
      and stores.status = 'published'
  )
);
