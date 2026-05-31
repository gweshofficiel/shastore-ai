create extension if not exists "pgcrypto";

create table if not exists public.store_navigation_links (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  workspace_id uuid not null,
  label text not null,
  location text not null
    check (location in ('header', 'footer')),
  link_type text not null
    check (link_type in ('home', 'page', 'category', 'product', 'custom')),
  page_id uuid null references public.store_pages(id) on delete set null,
  category_id uuid null references public.store_categories(id) on delete set null,
  product_id uuid null references public.store_products(id) on delete set null,
  custom_url text null,
  sort_order integer not null default 0,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists store_navigation_links_store_location_order_idx
on public.store_navigation_links(store_id, location, is_enabled, sort_order, created_at);

create index if not exists store_navigation_links_workspace_store_idx
on public.store_navigation_links(workspace_id, store_id);

alter table public.store_navigation_links enable row level security;

drop policy if exists "workspace members read own store navigation links" on public.store_navigation_links;
drop policy if exists "workspace editors manage own store navigation links" on public.store_navigation_links;
drop policy if exists "public reads enabled store navigation links" on public.store_navigation_links;
drop policy if exists "service role manages store navigation links" on public.store_navigation_links;

create policy "workspace members read own store navigation links"
on public.store_navigation_links
for select
to authenticated
using (public.can_access_workspace(workspace_id));

create policy "workspace editors manage own store navigation links"
on public.store_navigation_links
for all
to authenticated
using (public.workspace_can_edit(workspace_id))
with check (public.workspace_can_edit(workspace_id));

create policy "public reads enabled store navigation links"
on public.store_navigation_links
for select
to anon, authenticated
using (
  is_enabled = true
  and exists (
    select 1
    from public.stores stores
    left join public.published_stores published
      on published.store_id = stores.id
    where stores.id = store_navigation_links.store_id
      and stores.status = 'published'
      and coalesce(published.status, 'published') = 'published'
      and coalesce(published.visibility, 'public') = 'public'
  )
);

create policy "service role manages store navigation links"
on public.store_navigation_links
for all
to service_role
using (true)
with check (true);

grant select, insert, update, delete on public.store_navigation_links to authenticated;
grant select on public.store_navigation_links to anon;
grant all on public.store_navigation_links to service_role;
