-- Real Store Mode ownership foundation.
-- Additive and idempotent: keeps existing user_id/name columns for compatibility while
-- establishing owner_user_id + workspace_id + store_name as the canonical ownership model.

alter table public.stores
add column if not exists owner_user_id uuid references auth.users(id) on delete cascade;

alter table public.stores
add column if not exists workspace_id uuid;

alter table public.stores
add column if not exists store_name text;

alter table public.stores
add column if not exists slug text;

alter table public.stores
add column if not exists subscription_plan text not null default 'free';

update public.stores
set owner_user_id = user_id
where owner_user_id is null
  and user_id is not null;

update public.stores
set workspace_id = owner_user_id
where workspace_id is null
  and owner_user_id is not null;

update public.stores
set store_name = name
where store_name is null
  and name is not null;

alter table public.stores
alter column owner_user_id set not null;

alter table public.stores
alter column workspace_id set not null;

alter table public.stores
alter column store_name set not null;

create index if not exists stores_owner_user_id_idx
on public.stores(owner_user_id);

create index if not exists stores_workspace_id_idx
on public.stores(workspace_id);

create index if not exists stores_owner_status_created_idx
on public.stores(owner_user_id, status, created_at desc);

create unique index if not exists stores_slug_unique_idx
on public.stores(slug)
where slug is not null;

create or replace function public.shastore_is_admin()
returns boolean
language sql
stable
as $$
  select
    coalesce(auth.jwt() ->> 'role', '') = 'admin'
    or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
    or coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'admin';
$$;

create or replace function public.set_store_ownership_defaults()
returns trigger
language plpgsql
as $$
begin
  new.owner_user_id := coalesce(new.owner_user_id, new.user_id, auth.uid());
  new.user_id := coalesce(new.user_id, new.owner_user_id);
  new.workspace_id := coalesce(new.workspace_id, new.owner_user_id);
  new.store_name := coalesce(nullif(new.store_name, ''), nullif(new.name, ''), 'Untitled store');
  new.name := coalesce(nullif(new.name, ''), new.store_name);
  new.subscription_plan := coalesce(nullif(new.subscription_plan, ''), 'free');
  new.status := coalesce(new.status, 'draft');
  return new;
end;
$$;

drop trigger if exists stores_ownership_defaults on public.stores;

create trigger stores_ownership_defaults
before insert or update on public.stores
for each row execute function public.set_store_ownership_defaults();

alter table public.stores enable row level security;

drop policy if exists "Users manage own stores" on public.stores;
drop policy if exists "store owners can view own stores" on public.stores;
drop policy if exists "store owners can insert own stores" on public.stores;
drop policy if exists "store owners can update own stores" on public.stores;
drop policy if exists "store owners can delete own stores" on public.stores;

create policy "store owners can view own stores"
on public.stores
for select
to authenticated
using (auth.uid() = owner_user_id or public.shastore_is_admin());

create policy "store owners can insert own stores"
on public.stores
for insert
to authenticated
with check (
  auth.uid() = owner_user_id
  and auth.uid() = user_id
  and workspace_id = owner_user_id
);

create policy "store owners can update own stores"
on public.stores
for update
to authenticated
using (auth.uid() = owner_user_id or public.shastore_is_admin())
with check (
  public.shastore_is_admin()
  or (
    auth.uid() = owner_user_id
    and auth.uid() = user_id
    and workspace_id = owner_user_id
  )
);

create policy "store owners can delete own stores"
on public.stores
for delete
to authenticated
using (auth.uid() = owner_user_id or public.shastore_is_admin());
