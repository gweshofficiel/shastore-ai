-- Product Image Upload Runtime Stabilization.
-- Ensures the product-images bucket has the full policy set required by runtime uploads.

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = true;

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
