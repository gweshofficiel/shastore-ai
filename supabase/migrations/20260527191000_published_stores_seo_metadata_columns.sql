-- Store publication SEO/OpenGraph metadata columns.
-- Additive only: preserves existing published stores and publication state.

alter table if exists public.published_stores
  add column if not exists seo_title text,
  add column if not exists seo_description text,
  add column if not exists og_title text,
  add column if not exists og_description text,
  add column if not exists favicon_url text,
  add column if not exists social_image_url text;
