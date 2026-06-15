-- Platform public website pages runtime registry.
-- Additive only: does not modify Store Owner pages, storefront pages, page builder,
-- template engine, billing, payments, subscriptions, AI control, domains, or public route behavior.

create extension if not exists "pgcrypto";

create table if not exists public.platform_pages (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  page_type text not null,
  status text not null default 'draft',
  route_path text not null,
  seo_status text not null default 'placeholder',
  readiness_status text not null default 'placeholder',
  language_status jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  is_system boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_pages_status_check
    check (status in ('draft', 'published', 'archived')),
  constraint platform_pages_readiness_status_check
    check (readiness_status in ('ready', 'placeholder', 'needs_attention')),
  constraint platform_pages_seo_status_check
    check (seo_status in ('ready', 'placeholder', 'missing'))
);

create index if not exists platform_pages_sort_order_idx
on public.platform_pages(sort_order, route_path);

create or replace function public.set_platform_pages_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists platform_pages_updated_at on public.platform_pages;
create trigger platform_pages_updated_at
before update on public.platform_pages
for each row execute function public.set_platform_pages_updated_at();

alter table public.platform_pages enable row level security;

drop policy if exists "service role can manage platform pages" on public.platform_pages;
create policy "service role can manage platform pages"
on public.platform_pages
for all
to service_role
using (true)
with check (true);

insert into public.platform_pages (
  slug,
  title,
  page_type,
  status,
  route_path,
  seo_status,
  readiness_status,
  language_status,
  sort_order,
  is_system
)
values
  ('homepage', 'Homepage', 'homepage', 'published', '/', 'placeholder', 'ready', '{"English":"ready","Arabic":"placeholder","French":"placeholder"}'::jsonb, 10, true),
  ('pricing', 'Pricing Page', 'pricing', 'published', '/pricing', 'placeholder', 'ready', '{"English":"ready","Arabic":"placeholder","French":"placeholder"}'::jsonb, 20, true),
  ('features', 'Features Page', 'features', 'draft', '/features', 'placeholder', 'placeholder', '{"English":"placeholder","Arabic":"placeholder","French":"placeholder"}'::jsonb, 30, true),
  ('about', 'About Us', 'about', 'draft', '/about', 'placeholder', 'placeholder', '{"English":"placeholder","Arabic":"placeholder","French":"placeholder"}'::jsonb, 40, true),
  ('contact', 'Contact Us', 'contact', 'draft', '/contact', 'placeholder', 'placeholder', '{"English":"placeholder","Arabic":"placeholder","French":"placeholder"}'::jsonb, 50, true),
  ('blog', 'Blog', 'blog', 'draft', '/blog', 'placeholder', 'placeholder', '{"English":"placeholder","Arabic":"placeholder","French":"placeholder"}'::jsonb, 60, true),
  ('affiliates', 'Affiliates Page', 'affiliates', 'draft', '/affiliates', 'placeholder', 'placeholder', '{"English":"placeholder","Arabic":"placeholder","French":"placeholder"}'::jsonb, 70, true),
  ('reseller', 'Reseller Program Page', 'reseller', 'published', '/reseller', 'placeholder', 'ready', '{"English":"ready","Arabic":"placeholder","French":"placeholder"}'::jsonb, 80, true),
  ('careers', 'Careers Page', 'careers', 'draft', '/careers', 'placeholder', 'placeholder', '{"English":"placeholder","Arabic":"placeholder","French":"placeholder"}'::jsonb, 90, true),
  ('legal', 'Legal Pages', 'legal', 'draft', '/legal', 'missing', 'needs_attention', '{"English":"placeholder","Arabic":"placeholder","French":"placeholder"}'::jsonb, 100, true)
on conflict (slug) do nothing;
