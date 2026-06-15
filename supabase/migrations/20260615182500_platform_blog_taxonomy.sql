-- Platform public website blog categories and tags runtime.
-- Additive only: does not modify storefronts, Store Builder, customer blogs,
-- customer pages, billing, payments, hosting, domains, or AI control.

create extension if not exists "pgcrypto";

create table if not exists public.platform_blog_categories (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text null,
  seo_title text null,
  seo_description text null,
  translations jsonb not null default '{}'::jsonb,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_blog_categories_status_check
    check (status in ('active', 'archived'))
);

create table if not exists public.platform_blog_tags (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  translations jsonb not null default '{}'::jsonb,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_blog_tags_status_check
    check (status in ('active', 'archived'))
);

create table if not exists public.platform_blog_post_categories (
  post_id uuid not null references public.platform_blog_posts(id) on delete cascade,
  category_id uuid not null references public.platform_blog_categories(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, category_id)
);

create table if not exists public.platform_blog_post_tags (
  post_id uuid not null references public.platform_blog_posts(id) on delete cascade,
  tag_id uuid not null references public.platform_blog_tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, tag_id)
);

create index if not exists platform_blog_categories_status_idx
on public.platform_blog_categories(status, created_at desc);

create index if not exists platform_blog_tags_status_idx
on public.platform_blog_tags(status, created_at desc);

create index if not exists platform_blog_post_categories_category_idx
on public.platform_blog_post_categories(category_id, post_id);

create index if not exists platform_blog_post_tags_tag_idx
on public.platform_blog_post_tags(tag_id, post_id);

create or replace function public.set_platform_blog_categories_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.set_platform_blog_tags_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists platform_blog_categories_updated_at on public.platform_blog_categories;
create trigger platform_blog_categories_updated_at
before update on public.platform_blog_categories
for each row execute function public.set_platform_blog_categories_updated_at();

drop trigger if exists platform_blog_tags_updated_at on public.platform_blog_tags;
create trigger platform_blog_tags_updated_at
before update on public.platform_blog_tags
for each row execute function public.set_platform_blog_tags_updated_at();

alter table public.platform_blog_categories enable row level security;
alter table public.platform_blog_tags enable row level security;
alter table public.platform_blog_post_categories enable row level security;
alter table public.platform_blog_post_tags enable row level security;

drop policy if exists "service role can manage platform blog categories" on public.platform_blog_categories;
create policy "service role can manage platform blog categories"
on public.platform_blog_categories
for all
to service_role
using (true)
with check (true);

drop policy if exists "service role can manage platform blog tags" on public.platform_blog_tags;
create policy "service role can manage platform blog tags"
on public.platform_blog_tags
for all
to service_role
using (true)
with check (true);

drop policy if exists "service role can manage platform blog post categories" on public.platform_blog_post_categories;
create policy "service role can manage platform blog post categories"
on public.platform_blog_post_categories
for all
to service_role
using (true)
with check (true);

drop policy if exists "service role can manage platform blog post tags" on public.platform_blog_post_tags;
create policy "service role can manage platform blog post tags"
on public.platform_blog_post_tags
for all
to service_role
using (true)
with check (true);
