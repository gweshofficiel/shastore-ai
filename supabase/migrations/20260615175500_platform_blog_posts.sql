-- Platform public website blog foundation.
-- Additive only: does not modify storefronts, Store Builder, customer blogs,
-- customer pages, billing, payments, hosting, domains, or AI control.

create extension if not exists "pgcrypto";

create table if not exists public.platform_blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  excerpt text not null default '',
  content jsonb not null default '{}'::jsonb,
  status text not null default 'draft',
  author_name text not null default 'SHASTORE AI',
  cover_image_url text null,
  seo_title text null,
  seo_description text null,
  translations jsonb not null default '{}'::jsonb,
  published_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_blog_posts_status_check
    check (status in ('draft', 'published', 'archived'))
);

create index if not exists platform_blog_posts_status_created_idx
on public.platform_blog_posts(status, created_at desc);

create index if not exists platform_blog_posts_published_idx
on public.platform_blog_posts(published_at desc)
where status = 'published';

create or replace function public.set_platform_blog_posts_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists platform_blog_posts_updated_at on public.platform_blog_posts;
create trigger platform_blog_posts_updated_at
before update on public.platform_blog_posts
for each row execute function public.set_platform_blog_posts_updated_at();

alter table public.platform_blog_posts enable row level security;

drop policy if exists "service role can manage platform blog posts" on public.platform_blog_posts;
create policy "service role can manage platform blog posts"
on public.platform_blog_posts
for all
to service_role
using (true)
with check (true);
