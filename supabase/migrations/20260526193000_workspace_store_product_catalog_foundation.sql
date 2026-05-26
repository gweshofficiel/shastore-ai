-- Workspace Store Product Catalog Foundation.
-- Additive only: extends existing store_products without dropping data.

alter table if exists public.store_products
  add column if not exists workspace_id uuid,
  add column if not exists owner_user_id uuid,
  add column if not exists title text,
  add column if not exists slug text,
  add column if not exists compare_at_price numeric,
  add column if not exists currency text not null default 'USD',
  add column if not exists gallery jsonb not null default '[]'::jsonb,
  add column if not exists status text not null default 'draft';

do $$
begin
  if to_regclass('public.store_products') is not null
     and to_regclass('public.stores') is not null then
    update public.store_products products
    set
      workspace_id = coalesce(products.workspace_id, stores.workspace_id, products.user_id),
      owner_user_id = coalesce(products.owner_user_id, stores.owner_user_id, products.user_id),
      title = coalesce(nullif(products.title, ''), nullif(products.name, ''), 'Untitled product'),
      slug = coalesce(
        nullif(products.slug, ''),
        lower(
          regexp_replace(
            regexp_replace(
              trim(coalesce(nullif(products.title, ''), nullif(products.name, ''), 'product')),
              '[^a-zA-Z0-9]+',
              '-',
              'g'
            ),
            '(^-|-$)',
            '',
            'g'
          )
        ) || '-' || left(replace(products.id::text, '-', ''), 8)
      ),
      currency = coalesce(nullif(products.currency, ''), nullif(stores.currency, ''), 'USD'),
      gallery = coalesce(products.gallery, '[]'::jsonb),
      status = case
        when products.status = 'published' then 'active'
        when products.status in ('draft', 'active', 'archived') then products.status
        else 'draft'
      end
    from public.stores stores
    where products.store_id = stores.id;

    update public.store_products products
    set
      title = coalesce(nullif(products.title, ''), 'Untitled product'),
      slug = coalesce(nullif(products.slug, ''), 'product-' || left(replace(products.id::text, '-', ''), 8)),
      currency = coalesce(nullif(products.currency, ''), 'USD'),
      gallery = coalesce(products.gallery, '[]'::jsonb),
      status = case
        when products.status = 'published' then 'active'
        when products.status in ('draft', 'active', 'archived') then products.status
        else 'draft'
      end
    where products.title is null
       or products.slug is null
       or products.currency is null
       or products.gallery is null
       or products.status is null
       or products.status not in ('draft', 'active', 'archived');
  end if;
end $$;

do $$
begin
  if to_regclass('public.store_products') is not null then
    if not exists (
      select 1
      from pg_constraint
      where conname = 'store_products_catalog_status_check'
        and conrelid = 'public.store_products'::regclass
    ) then
      alter table public.store_products
        add constraint store_products_catalog_status_check
        check (status in ('draft', 'active', 'archived'));
    end if;

    create unique index if not exists store_products_store_slug_unique_idx
      on public.store_products(store_id, slug);

    create index if not exists store_products_workspace_store_status_idx
      on public.store_products(workspace_id, store_id, status, updated_at desc);

    create index if not exists store_products_owner_idx
      on public.store_products(owner_user_id, updated_at desc);
  end if;
end $$;

do $$
begin
  if to_regclass('public.store_products') is not null then
    alter table public.store_products enable row level security;

    drop policy if exists "public can read published store products" on public.store_products;
    create policy "public can read active published store products"
    on public.store_products
    for select
    to anon, authenticated
    using (
      status = 'active'
      and exists (
        select 1
        from public.stores stores
        join public.published_stores published
          on published.store_id = stores.id
        where stores.id = store_products.store_id
          and stores.status = 'published'
          and published.status = 'published'
          and published.visibility = 'public'
      )
    );
  end if;
end $$;
