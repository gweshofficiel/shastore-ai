-- Product reviews advanced.
-- Additive only: keeps the existing reviews foundation, products, orders, customers, checkout, and cart intact.

alter table if exists public.product_reviews
  add column if not exists verified_purchase boolean not null default false,
  add column if not exists seller_reply text,
  add column if not exists seller_replied_at timestamptz,
  add column if not exists featured boolean not null default false,
  add column if not exists review_images jsonb not null default '[]'::jsonb;

update public.product_reviews
set verified_purchase = true
where order_id is not null
  and verified_purchase = false;

create index if not exists product_reviews_public_filters_idx
on public.product_reviews(store_id, product_id, status, verified_purchase, featured, rating, created_at desc);
