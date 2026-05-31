-- Advanced SEO foundation for stores, pages, products, and categories.
-- Additive only: keeps existing data, policies, and storefront runtime intact.

alter table if exists public.stores
  add column if not exists seo_title text,
  add column if not exists seo_description text,
  add column if not exists seo_keywords text,
  add column if not exists og_title text,
  add column if not exists og_description text,
  add column if not exists og_image_url text,
  add column if not exists canonical_url text,
  add column if not exists noindex boolean not null default false;

alter table if exists public.published_stores
  add column if not exists seo_keywords text,
  add column if not exists og_image_url text,
  add column if not exists canonical_url text,
  add column if not exists noindex boolean not null default false;

alter table if exists public.store_pages
  add column if not exists seo_keywords text,
  add column if not exists og_title text,
  add column if not exists og_description text,
  add column if not exists og_image_url text,
  add column if not exists canonical_url text,
  add column if not exists noindex boolean not null default false;

alter table if exists public.store_products
  add column if not exists seo_title text,
  add column if not exists seo_description text,
  add column if not exists seo_keywords text,
  add column if not exists og_title text,
  add column if not exists og_description text,
  add column if not exists og_image_url text,
  add column if not exists canonical_url text,
  add column if not exists noindex boolean not null default false;

alter table if exists public.store_categories
  add column if not exists seo_title text,
  add column if not exists seo_description text,
  add column if not exists seo_keywords text,
  add column if not exists og_title text,
  add column if not exists og_description text,
  add column if not exists og_image_url text,
  add column if not exists canonical_url text,
  add column if not exists noindex boolean not null default false;
