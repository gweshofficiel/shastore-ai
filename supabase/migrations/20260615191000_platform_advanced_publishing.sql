-- Platform public website advanced publishing workflow.
-- Additive only: does not modify storefronts, Store Builder, customer blogs,
-- customer pages, billing, payments, hosting, domains, or AI control.

create extension if not exists "pgcrypto";

create table if not exists public.platform_content_revisions (
  id uuid primary key default gen_random_uuid(),
  content_type text not null,
  content_id uuid not null,
  revision_number integer not null,
  snapshot jsonb not null default '{}'::jsonb,
  created_by uuid null,
  created_at timestamptz not null default now(),
  note text null,
  constraint platform_content_revisions_content_type_check
    check (content_type in ('platform_page', 'platform_blog_post', 'platform_page_block')),
  constraint platform_content_revisions_revision_number_check
    check (revision_number > 0)
);

create unique index if not exists platform_content_revisions_unique_idx
on public.platform_content_revisions(content_type, content_id, revision_number);

create index if not exists platform_content_revisions_content_idx
on public.platform_content_revisions(content_type, content_id, created_at desc);

alter table public.platform_pages
add column if not exists approval_status text not null default 'draft',
add column if not exists approved_by uuid null,
add column if not exists approved_at timestamptz null,
add column if not exists scheduled_publish_at timestamptz null;

alter table public.platform_blog_posts
add column if not exists approval_status text not null default 'draft',
add column if not exists approved_by uuid null,
add column if not exists approved_at timestamptz null,
add column if not exists scheduled_publish_at timestamptz null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'platform_pages_approval_status_check'
  ) then
    alter table public.platform_pages
    add constraint platform_pages_approval_status_check
      check (approval_status in ('draft', 'pending_review', 'approved', 'rejected'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'platform_blog_posts_approval_status_check'
  ) then
    alter table public.platform_blog_posts
    add constraint platform_blog_posts_approval_status_check
      check (approval_status in ('draft', 'pending_review', 'approved', 'rejected'));
  end if;
end;
$$;

create index if not exists platform_pages_approval_status_idx
on public.platform_pages(approval_status, scheduled_publish_at);

create index if not exists platform_blog_posts_approval_status_idx
on public.platform_blog_posts(approval_status, scheduled_publish_at);

alter table public.platform_content_revisions enable row level security;

drop policy if exists "service role can manage platform content revisions" on public.platform_content_revisions;
create policy "service role can manage platform content revisions"
on public.platform_content_revisions
for all
to service_role
using (true)
with check (true);
