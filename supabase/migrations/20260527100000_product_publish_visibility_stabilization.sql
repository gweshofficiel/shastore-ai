-- Product Publish & Visibility Stabilization.
-- Additive/safe normalization around the existing store_products.status column.

alter table if exists public.store_products
  add column if not exists status text not null default 'draft';

update public.store_products
set status = case
  when status = 'published' then 'active'
  when status in ('draft', 'active', 'archived') then status
  else 'draft'
end
where status is null
   or status = 'published'
   or status not in ('draft', 'active', 'archived');

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

    create index if not exists store_products_public_active_idx
      on public.store_products(store_id, updated_at desc)
      where status = 'active';
  end if;
end $$;
