-- Multi-language storefront foundation.
-- Additive only: keeps existing content columns as the default/fallback source.

alter table if exists public.stores
  add column if not exists language_settings jsonb not null default '{}'::jsonb,
  add column if not exists translations jsonb not null default '{}'::jsonb;

alter table if exists public.store_products
  add column if not exists translations jsonb not null default '{}'::jsonb;

alter table if exists public.store_categories
  add column if not exists translations jsonb not null default '{}'::jsonb;

alter table if exists public.store_pages
  add column if not exists translations jsonb not null default '{}'::jsonb;

alter table if exists public.store_blog_articles
  add column if not exists translations jsonb not null default '{}'::jsonb;

alter table if exists public.store_faqs
  add column if not exists translations jsonb not null default '{}'::jsonb;

alter table if exists public.store_homepage_sections
  add column if not exists translations jsonb not null default '{}'::jsonb;

create index if not exists stores_language_settings_idx
on public.stores using gin (language_settings);

create index if not exists store_products_translations_idx
on public.store_products using gin (translations);

create index if not exists store_categories_translations_idx
on public.store_categories using gin (translations);

create index if not exists store_pages_translations_idx
on public.store_pages using gin (translations);

create index if not exists store_blog_articles_translations_idx
on public.store_blog_articles using gin (translations);

create index if not exists store_faqs_translations_idx
on public.store_faqs using gin (translations);

create index if not exists store_homepage_sections_translations_idx
on public.store_homepage_sections using gin (translations);
