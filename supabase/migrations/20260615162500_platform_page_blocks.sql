-- Platform public website landing blocks runtime.
-- Additive only: does not modify storefronts, Store Builder, customer pages,
-- customer translations, billing, payments, hosting, domains, or AI control.

create extension if not exists "pgcrypto";

create table if not exists public.platform_page_blocks (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.platform_pages(id) on delete cascade,
  block_type text not null,
  title text null,
  subtitle text null,
  content jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_page_blocks_block_type_check
    check (block_type in ('hero', 'features', 'pricing', 'cta', 'faq', 'testimonials', 'stats', 'footer', 'custom')),
  constraint platform_page_blocks_status_check
    check (status in ('draft', 'published', 'hidden'))
);

create index if not exists platform_page_blocks_page_sort_idx
on public.platform_page_blocks(page_id, sort_order, created_at);

create index if not exists platform_page_blocks_published_idx
on public.platform_page_blocks(page_id, status, sort_order)
where status = 'published';

create or replace function public.set_platform_page_blocks_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists platform_page_blocks_updated_at on public.platform_page_blocks;
create trigger platform_page_blocks_updated_at
before update on public.platform_page_blocks
for each row execute function public.set_platform_page_blocks_updated_at();

alter table public.platform_page_blocks enable row level security;

drop policy if exists "service role can manage platform page blocks" on public.platform_page_blocks;
create policy "service role can manage platform page blocks"
on public.platform_page_blocks
for all
to service_role
using (true)
with check (true);
