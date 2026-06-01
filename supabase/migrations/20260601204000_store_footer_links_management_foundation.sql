-- Storefront footer links management foundation.
-- Additive only: store-scoped footer link visibility settings.

alter table if exists public.stores
  add column if not exists footer_link_settings jsonb not null default '{
    "products": true,
    "categories": true,
    "faq": true,
    "contact": true,
    "blog": true,
    "privacy": true,
    "terms": true,
    "refund": true,
    "shipping": false
  }'::jsonb;
