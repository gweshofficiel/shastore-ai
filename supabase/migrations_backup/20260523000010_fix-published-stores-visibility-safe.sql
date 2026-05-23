-- Fix missing published_stores.visibility for checkout RPCs and storefront publish flow.
-- Idempotent: safe on DBs created from base schema.sql before store-system-safe.sql.
-- Does not recreate tables or drop data.

alter table if exists public.published_stores
  add column if not exists visibility text;

update public.published_stores
set visibility = 'public'
where visibility is null;

alter table if exists public.published_stores
  alter column visibility set default 'public';

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'published_stores'
      and column_name = 'visibility'
      and is_nullable = 'YES'
  ) then
    alter table public.published_stores
      alter column visibility set not null;
  end if;
exception
  when others then
    null;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.published_stores'::regclass
      and conname = 'published_stores_visibility_check'
  ) then
    alter table public.published_stores
      add constraint published_stores_visibility_check
      check (visibility in ('public', 'private'));
  end if;
end $$;

create index if not exists published_stores_visibility_idx
  on public.published_stores(visibility);

