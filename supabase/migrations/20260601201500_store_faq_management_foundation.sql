-- Storefront FAQ management foundation.
-- Additive only: store-scoped FAQs with draft/published visibility.

create table if not exists public.store_faqs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  store_id uuid not null references public.stores(id) on delete cascade,
  question text not null,
  answer text not null,
  status text not null default 'draft'
    check (status in ('draft', 'published')),
  sort_order integer,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists store_faqs_workspace_store_status_idx
on public.store_faqs(workspace_id, store_id, status, sort_order, created_at desc);

create index if not exists store_faqs_store_status_idx
on public.store_faqs(store_id, status, sort_order);

alter table public.store_faqs enable row level security;

drop policy if exists "workspace members read store faqs" on public.store_faqs;
drop policy if exists "workspace editors manage store faqs" on public.store_faqs;
drop policy if exists "public reads published store faqs" on public.store_faqs;

create policy "workspace members read store faqs"
on public.store_faqs
for select
to authenticated
using (public.can_access_workspace(workspace_id));

create policy "workspace editors manage store faqs"
on public.store_faqs
for all
to authenticated
using (public.workspace_can_edit(workspace_id))
with check (public.workspace_can_edit(workspace_id));

create policy "public reads published store faqs"
on public.store_faqs
for select
to anon, authenticated
using (
  status = 'published'
  and exists (
    select 1
    from public.stores stores
    left join public.published_stores published
      on published.store_id = stores.id
    where stores.id = store_faqs.store_id
      and stores.status = 'published'
      and coalesce(published.status, 'published') = 'published'
      and coalesce(published.visibility, 'public') = 'public'
  )
);
