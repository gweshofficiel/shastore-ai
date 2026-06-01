-- Storefront blog/articles foundation.
-- Additive only: store-scoped articles for SEO and marketing content.

create table if not exists public.store_blog_articles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  store_id uuid not null references public.stores(id) on delete cascade,
  title text not null,
  slug text not null,
  excerpt text,
  content text not null,
  cover_image_url text,
  status text not null default 'draft'
    check (status in ('draft', 'published')),
  published_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, slug)
);

create index if not exists store_blog_articles_workspace_store_status_idx
on public.store_blog_articles(workspace_id, store_id, status, updated_at desc);

create index if not exists store_blog_articles_store_slug_status_idx
on public.store_blog_articles(store_id, slug, status);

alter table public.store_blog_articles enable row level security;

drop policy if exists "workspace members read store blog articles" on public.store_blog_articles;
drop policy if exists "workspace editors manage store blog articles" on public.store_blog_articles;
drop policy if exists "public reads published store blog articles" on public.store_blog_articles;

create policy "workspace members read store blog articles"
on public.store_blog_articles
for select
to authenticated
using (public.can_access_workspace(workspace_id));

create policy "workspace editors manage store blog articles"
on public.store_blog_articles
for all
to authenticated
using (public.workspace_can_edit(workspace_id))
with check (public.workspace_can_edit(workspace_id));

create policy "public reads published store blog articles"
on public.store_blog_articles
for select
to anon, authenticated
using (
  status = 'published'
  and exists (
    select 1
    from public.stores stores
    left join public.published_stores published
      on published.store_id = stores.id
    where stores.id = store_blog_articles.store_id
      and stores.status = 'published'
      and coalesce(published.status, 'published') = 'published'
      and coalesce(published.visibility, 'public') = 'public'
  )
);
