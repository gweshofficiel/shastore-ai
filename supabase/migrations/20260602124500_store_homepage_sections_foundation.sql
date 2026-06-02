-- Storefront homepage sections builder foundation.
-- Additive only: store-scoped homepage section visibility and ordering.

create table if not exists public.store_homepage_sections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  store_id uuid not null references public.stores(id) on delete cascade,
  section_type text not null
    check (
      section_type in (
        'hero',
        'featured_products',
        'featured_categories',
        'featured_collection',
        'about_preview',
        'testimonials',
        'newsletter',
        'faq_preview',
        'blog_preview'
      )
    ),
  title text,
  subtitle text,
  enabled boolean not null default true,
  sort_order integer not null default 0,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint store_homepage_sections_store_type_unique unique (store_id, section_type)
);

create index if not exists store_homepage_sections_workspace_store_order_idx
on public.store_homepage_sections(workspace_id, store_id, sort_order, created_at);

alter table public.store_homepage_sections enable row level security;

drop policy if exists "workspace members read store homepage sections" on public.store_homepage_sections;
drop policy if exists "store owners manage homepage sections" on public.store_homepage_sections;
drop policy if exists "public reads homepage sections for published stores" on public.store_homepage_sections;

create policy "workspace members read store homepage sections"
on public.store_homepage_sections
for select
to authenticated
using (public.can_access_workspace(workspace_id));

create policy "store owners manage homepage sections"
on public.store_homepage_sections
for all
to authenticated
using (
  public.can_access_workspace(workspace_id)
  and exists (
    select 1
    from public.stores stores
    where stores.id = store_homepage_sections.store_id
      and stores.workspace_id = store_homepage_sections.workspace_id
      and (
        stores.owner_user_id = auth.uid()
        or public.workspace_member_role(store_homepage_sections.workspace_id) in ('owner', 'admin')
      )
  )
)
with check (
  public.can_access_workspace(workspace_id)
  and exists (
    select 1
    from public.stores stores
    where stores.id = store_homepage_sections.store_id
      and stores.workspace_id = store_homepage_sections.workspace_id
      and (
        stores.owner_user_id = auth.uid()
        or public.workspace_member_role(store_homepage_sections.workspace_id) in ('owner', 'admin')
      )
  )
);

create policy "public reads homepage sections for published stores"
on public.store_homepage_sections
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.stores stores
    left join public.published_stores published
      on published.store_id = stores.id
    where stores.id = store_homepage_sections.store_id
      and stores.workspace_id = store_homepage_sections.workspace_id
      and stores.status = 'published'
      and coalesce(published.status, 'published') = 'published'
      and coalesce(published.visibility, 'public') = 'public'
  )
);

grant select, insert, update, delete on public.store_homepage_sections to authenticated;
grant select on public.store_homepage_sections to anon;
grant all on public.store_homepage_sections to service_role;
