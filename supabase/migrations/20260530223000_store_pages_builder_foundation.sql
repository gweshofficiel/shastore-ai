create extension if not exists "pgcrypto";

create table if not exists public.store_pages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  store_id uuid not null references public.stores(id) on delete cascade,
  title text not null,
  slug text not null,
  content text,
  page_type text not null default 'custom'
    check (page_type in ('about', 'contact', 'faq', 'terms', 'privacy', 'shipping', 'returns', 'custom')),
  status text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),
  seo_title text,
  seo_description text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, slug)
);

create table if not exists public.page_activity_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  store_id uuid not null references public.stores(id) on delete cascade,
  page_id uuid references public.store_pages(id) on delete cascade,
  action text not null,
  created_at timestamptz not null default now()
);

create index if not exists store_pages_workspace_store_status_idx
on public.store_pages(workspace_id, store_id, status, updated_at desc);

create index if not exists store_pages_store_slug_status_idx
on public.store_pages(store_id, slug, status);

create index if not exists store_pages_search_idx
on public.store_pages using gin (
  to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content, ''))
);

create index if not exists page_activity_logs_page_created_idx
on public.page_activity_logs(page_id, created_at desc);

create index if not exists page_activity_logs_workspace_created_idx
on public.page_activity_logs(workspace_id, created_at desc);

alter table public.store_pages enable row level security;
alter table public.page_activity_logs enable row level security;

drop policy if exists "workspace members read own store pages" on public.store_pages;
drop policy if exists "workspace editors manage own store pages" on public.store_pages;
drop policy if exists "public reads published store pages" on public.store_pages;
drop policy if exists "platform admins read store pages" on public.store_pages;
drop policy if exists "service role manages store pages" on public.store_pages;

create policy "workspace members read own store pages"
on public.store_pages
for select
to authenticated
using (public.can_access_workspace(workspace_id));

create policy "workspace editors manage own store pages"
on public.store_pages
for all
to authenticated
using (public.workspace_can_edit(workspace_id))
with check (public.workspace_can_edit(workspace_id));

create policy "public reads published store pages"
on public.store_pages
for select
to anon, authenticated
using (
  status = 'published'
  and exists (
    select 1
    from public.stores stores
    left join public.published_stores published
      on published.store_id = stores.id
    where stores.id = store_pages.store_id
      and stores.status = 'published'
      and coalesce(published.status, 'published') = 'published'
      and coalesce(published.visibility, 'public') = 'public'
  )
);

create policy "platform admins read store pages"
on public.store_pages
for select
to authenticated
using (public.shastore_is_admin());

create policy "service role manages store pages"
on public.store_pages
for all
to service_role
using (true)
with check (true);

drop policy if exists "workspace members read page activity logs" on public.page_activity_logs;
drop policy if exists "workspace editors insert page activity logs" on public.page_activity_logs;
drop policy if exists "platform admins read page activity logs" on public.page_activity_logs;
drop policy if exists "service role manages page activity logs" on public.page_activity_logs;

create policy "workspace members read page activity logs"
on public.page_activity_logs
for select
to authenticated
using (public.can_access_workspace(workspace_id));

create policy "workspace editors insert page activity logs"
on public.page_activity_logs
for insert
to authenticated
with check (public.workspace_can_edit(workspace_id));

create policy "platform admins read page activity logs"
on public.page_activity_logs
for select
to authenticated
using (public.shastore_is_admin());

create policy "service role manages page activity logs"
on public.page_activity_logs
for all
to service_role
using (true)
with check (true);

grant select, insert, update, delete on public.store_pages to authenticated;
grant select, insert on public.page_activity_logs to authenticated;
grant select on public.store_pages to anon;
grant all on public.store_pages to service_role;
grant all on public.page_activity_logs to service_role;
