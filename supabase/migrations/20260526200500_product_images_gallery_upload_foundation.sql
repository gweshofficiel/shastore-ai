-- Product Images + Gallery Upload Foundation.
-- Additive only: keeps existing product image URLs and gallery JSON intact.

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  store_id uuid not null references public.stores(id) on delete cascade,
  product_id uuid not null references public.store_products(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  storage_bucket text not null default 'product-images',
  storage_path text not null,
  public_url text not null,
  image_role text not null default 'gallery',
  file_name text,
  content_type text,
  file_size integer,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint product_images_role_check check (image_role in ('main', 'gallery')),
  constraint product_images_bucket_check check (storage_bucket = 'product-images')
);

create unique index if not exists product_images_storage_path_unique_idx
  on public.product_images(storage_bucket, storage_path);

create index if not exists product_images_workspace_store_product_idx
  on public.product_images(workspace_id, store_id, product_id, image_role, sort_order);

create unique index if not exists product_images_one_main_per_product_idx
  on public.product_images(product_id)
  where image_role = 'main';

alter table public.product_images enable row level security;

drop policy if exists "workspace members read product images" on public.product_images;
create policy "workspace members read product images"
on public.product_images
for select
to authenticated
using (public.can_access_workspace(workspace_id));

drop policy if exists "workspace editors write product images" on public.product_images;
create policy "workspace editors write product images"
on public.product_images
for all
to authenticated
using (public.workspace_can_edit(workspace_id))
with check (public.workspace_can_edit(workspace_id));

drop policy if exists "public can read active published product images" on public.product_images;
create policy "public can read active published product images"
on public.product_images
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.store_products products
    join public.stores stores
      on stores.id = products.store_id
    join public.published_stores published
      on published.store_id = stores.id
    where products.id = product_images.product_id
      and products.store_id = product_images.store_id
      and products.workspace_id = product_images.workspace_id
      and products.status = 'active'
      and stores.status = 'published'
      and published.status = 'published'
      and published.visibility = 'public'
  )
);

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Users update own product images'
  ) then
    create policy "Users update own product images" on storage.objects
      for update
      using (
        bucket_id = 'product-images'
        and auth.uid()::text = (storage.foldername(name))[1]
      )
      with check (
        bucket_id = 'product-images'
        and auth.uid()::text = (storage.foldername(name))[1]
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Users delete own product images'
  ) then
    create policy "Users delete own product images" on storage.objects
      for delete
      using (
        bucket_id = 'product-images'
        and auth.uid()::text = (storage.foldername(name))[1]
      );
  end if;
end $$;
