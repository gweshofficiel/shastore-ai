-- SEO Advanced settings center.
-- Additive only: keeps existing sitemap, robots, product/page SEO metadata, and storefront runtime intact.

alter table if exists public.stores
  add column if not exists seo_settings jsonb not null default '{}'::jsonb;

alter table if exists public.store_blog_articles
  add column if not exists seo_title text,
  add column if not exists seo_description text,
  add column if not exists og_title text,
  add column if not exists og_description text,
  add column if not exists og_image_url text,
  add column if not exists canonical_url text,
  add column if not exists noindex boolean not null default false;

create index if not exists store_blog_articles_seo_store_idx
on public.store_blog_articles(workspace_id, store_id, status, noindex);
