-- Product Image Upload Runtime Stabilization.
-- Ensures the product-images bucket has the full policy set required by runtime uploads.

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = true;

alter table if exists public.product_images
  add column if not exists workspace_id uuid,
  add column if not exists store_id uuid references public.stores(id) on delete cascade,
  add column if not exists product_id uuid references public.store_products(id) on delete cascade,
  add column if not exists owner_user_id uuid references auth.users(id) on delete cascade,
  add column if not exists storage_bucket text not null default 'product-images',
  add column if not exists image_role text not null default 'gallery',
  add column if not exists file_name text,
  add column if not exists content_type text,
  add column if not exists file_size integer;

alter table if exists public.product_images
  alter column landing_page_id drop not null;

update public.product_images
set
  image_role = coalesce(nullif(image_role, ''), nullif(image_type, ''), 'gallery'),
  storage_bucket = coalesce(nullif(storage_bucket, ''), 'product-images'),
  owner_user_id = coalesce(owner_user_id, user_id),
  workspace_id = coalesce(workspace_id, user_id)
where image_role is null
   or storage_bucket is null
   or owner_user_id is null
   or workspace_id is null;

create index if not exists product_images_product_store_idx
  on public.product_images(product_id, store_id, image_role, sort_order)
  where product_id is not null;

drop index if exists public.product_images_one_main_per_product_idx;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Users upload own product images'
  ) then
    create policy "Users upload own product images" on storage.objects
      for insert
      to authenticated
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
      and policyname = 'Product images are public'
  ) then
    create policy "Product images are public" on storage.objects
      for select
      to anon, authenticated
      using (bucket_id = 'product-images');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Users update own product images'
  ) then
    create policy "Users update own product images" on storage.objects
      for update
      to authenticated
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
      to authenticated
      using (
        bucket_id = 'product-images'
        and auth.uid()::text = (storage.foldername(name))[1]
      );
  end if;
end $$;
