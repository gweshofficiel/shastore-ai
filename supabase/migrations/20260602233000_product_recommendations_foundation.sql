-- Product recommendations foundation.
-- Additive only: one reusable recommendation engine source table for manual links.

create table if not exists public.product_recommendation_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  store_id uuid not null references public.stores(id) on delete cascade,
  source_product_id uuid references public.store_products(id) on delete cascade,
  recommended_product_id uuid not null references public.store_products(id) on delete cascade,
  recommendation_context text not null default 'related'
    check (recommendation_context in ('related', 'storefront')),
  sort_order integer not null default 0,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (source_product_id is null or source_product_id <> recommended_product_id)
);

create unique index if not exists product_recommendation_links_unique_idx
on public.product_recommendation_links(
  store_id,
  coalesce(source_product_id, '00000000-0000-0000-0000-000000000000'::uuid),
  recommended_product_id,
  recommendation_context
);

create index if not exists product_recommendation_links_lookup_idx
on public.product_recommendation_links(workspace_id, store_id, source_product_id, recommendation_context, status, sort_order);

alter table public.product_recommendation_links enable row level security;

drop policy if exists "workspace members read product recommendations" on public.product_recommendation_links;
drop policy if exists "workspace editors write product recommendations" on public.product_recommendation_links;
drop policy if exists "public can read active product recommendations" on public.product_recommendation_links;

create policy "workspace members read product recommendations"
on public.product_recommendation_links for select to authenticated
using (public.can_access_workspace(workspace_id));

create policy "workspace editors write product recommendations"
on public.product_recommendation_links for all to authenticated
using (public.workspace_can_edit(workspace_id))
with check (public.workspace_can_edit(workspace_id));

create policy "public can read active product recommendations"
on public.product_recommendation_links for select to anon, authenticated
using (
  status = 'active'
  and exists (
    select 1
    from public.stores stores
    where stores.id = product_recommendation_links.store_id
      and stores.status = 'published'
  )
);
