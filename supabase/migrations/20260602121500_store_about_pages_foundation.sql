-- Storefront dedicated About Us management foundation.
-- Additive only: one workspace/store-scoped About page per store.

create table if not exists public.store_about_pages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  store_id uuid not null references public.stores(id) on delete cascade,
  title text not null default 'About Us',
  subtitle text,
  company_story text,
  mission text,
  vision text,
  founder_message text,
  team_intro text,
  cover_image_url text,
  gallery_images jsonb not null default '[]'::jsonb,
  status text not null default 'draft'
    check (status in ('draft', 'published')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint store_about_pages_store_unique unique (store_id)
);

create index if not exists store_about_pages_workspace_store_status_idx
on public.store_about_pages(workspace_id, store_id, status, updated_at desc);

alter table public.store_about_pages enable row level security;

drop policy if exists "workspace members read store about pages" on public.store_about_pages;
drop policy if exists "workspace editors manage store about pages" on public.store_about_pages;
drop policy if exists "public reads published store about pages" on public.store_about_pages;

create policy "workspace members read store about pages"
on public.store_about_pages
for select
to authenticated
using (public.can_access_workspace(workspace_id));

create policy "workspace editors manage store about pages"
on public.store_about_pages
for all
to authenticated
using (public.workspace_can_edit(workspace_id))
with check (public.workspace_can_edit(workspace_id));

create policy "public reads published store about pages"
on public.store_about_pages
for select
to anon, authenticated
using (
  status = 'published'
  and exists (
    select 1
    from public.stores stores
    left join public.published_stores published
      on published.store_id = stores.id
    where stores.id = store_about_pages.store_id
      and stores.status = 'published'
      and coalesce(published.status, 'published') = 'published'
      and coalesce(published.visibility, 'public') = 'public'
  )
);
