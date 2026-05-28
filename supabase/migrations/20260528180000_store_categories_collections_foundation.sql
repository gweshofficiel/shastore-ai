-- Store categories and collections foundation.
-- Non-destructive: reuses public.store_categories and public.store_products.category_id.

alter table if exists public.store_categories
  add column if not exists workspace_id uuid,
  add column if not exists slug text,
  add column if not exists status text not null default 'active',
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if to_regclass('public.store_categories') is not null then
    if not exists (
      select 1
      from pg_constraint
      where conname = 'store_categories_status_check'
        and conrelid = 'public.store_categories'::regclass
    ) then
      alter table public.store_categories
        add constraint store_categories_status_check
        check (status in ('active', 'inactive'));
    end if;

    if to_regclass('public.stores') is not null then
      update public.store_categories categories
      set workspace_id = coalesce(categories.workspace_id, stores.workspace_id, categories.user_id)
      from public.stores stores
      where categories.store_id = stores.id
        and categories.workspace_id is null;
    end if;

    with normalized as (
      select
        id,
        store_id,
        coalesce(
          nullif(
            trim(both '-' from regexp_replace(lower(coalesce(name, 'category')), '[^a-z0-9]+', '-', 'g')),
            ''
          ),
          'category'
        ) as base_slug,
        row_number() over (
          partition by store_id,
          coalesce(
            nullif(
              trim(both '-' from regexp_replace(lower(coalesce(name, 'category')), '[^a-z0-9]+', '-', 'g')),
              ''
            ),
            'category'
          )
          order by created_at nulls last, id
        ) as duplicate_index
      from public.store_categories
      where slug is null or trim(slug) = ''
    )
    update public.store_categories categories
    set slug = case
      when normalized.duplicate_index = 1 then normalized.base_slug
      else normalized.base_slug || '-' || left(categories.id::text, 8)
    end
    from normalized
    where categories.id = normalized.id;

    alter table public.store_categories
      alter column slug set not null;

    create unique index if not exists store_categories_store_slug_idx
      on public.store_categories(store_id, slug);

    create index if not exists store_categories_workspace_status_idx
      on public.store_categories(workspace_id, store_id, status, sort_order);
  end if;
end $$;

alter table if exists public.store_categories enable row level security;

drop policy if exists "workspace members read store categories" on public.store_categories;
drop policy if exists "workspace editors write store categories" on public.store_categories;
drop policy if exists "public can read published store categories" on public.store_categories;

create policy "workspace members read store categories"
on public.store_categories
for select
to authenticated
using (public.can_access_workspace(workspace_id));

create policy "public can read published store categories"
on public.store_categories
for select
to anon, authenticated
using (
  status = 'active'
  and exists (
    select 1
    from public.stores stores
    where stores.id = store_categories.store_id
      and stores.status = 'published'
  )
);

create policy "workspace editors write store categories"
on public.store_categories
for all
to authenticated
using (public.workspace_can_edit(workspace_id))
with check (public.workspace_can_edit(workspace_id));
