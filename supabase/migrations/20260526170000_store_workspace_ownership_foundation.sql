-- Store workspace ownership foundation.
-- Safe and additive: backfills missing ownership fields before tightening store RLS.

alter table if exists public.stores
  add column if not exists workspace_id uuid,
  add column if not exists owner_user_id uuid,
  add column if not exists name text,
  add column if not exists slug text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

-- stores.status is publication_status enum ('draft', 'published', 'unpublished').
-- Do not add or coerce via empty string; enum rejects ''.

do $$
begin
  if to_regclass('public.stores') is not null then
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'stores' and column_name = 'user_id'
    ) then
      execute 'update public.stores set owner_user_id = coalesce(owner_user_id, user_id) where owner_user_id is null';
      execute 'update public.stores set workspace_id = coalesce(workspace_id, owner_user_id, user_id) where workspace_id is null';
    else
      update public.stores
      set workspace_id = coalesce(workspace_id, owner_user_id)
      where workspace_id is null;
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'stores' and column_name = 'store_name'
    ) then
      execute 'update public.stores set name = coalesce(nullif(name, ''''), store_name, ''Untitled store'') where name is null or name = ''''';
      execute 'update public.stores set store_name = coalesce(nullif(store_name, ''''), name) where store_name is null or store_name = ''''';
    else
      update public.stores
      set name = coalesce(nullif(name, ''), 'Untitled store')
      where name is null or name = '';
    end if;

    if exists (
      select 1
      from pg_type t
      join pg_namespace n on n.oid = t.typnamespace
      where n.nspname = 'public'
        and t.typname = 'publication_status'
    ) then
      update public.stores
      set status = 'draft'::publication_status
      where status is null;
    elsif exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'stores'
        and column_name = 'status'
        and udt_name <> 'publication_status'
    ) then
      execute $sql$
        update public.stores
        set status = 'draft'
        where status is null
      $sql$;
    end if;

    update public.stores
    set created_at = coalesce(created_at, now()),
        updated_at = coalesce(updated_at, created_at, now())
    where created_at is null or updated_at is null;

    insert into public.workspace_members (workspace_id, user_id, role, invited_by, status)
    select distinct stores.workspace_id, stores.owner_user_id, 'owner', stores.owner_user_id, 'active'
    from public.stores stores
    where stores.workspace_id is not null
      and stores.owner_user_id is not null
    on conflict (workspace_id, user_id) do nothing;

    create index if not exists stores_workspace_created_idx
      on public.stores(workspace_id, created_at desc);

    create index if not exists stores_workspace_slug_idx
      on public.stores(workspace_id, slug);

    create index if not exists stores_owner_user_idx
      on public.stores(owner_user_id);

    if not exists (select 1 from public.stores where workspace_id is null) then
      alter table public.stores alter column workspace_id set not null;
    end if;

    if not exists (select 1 from public.stores where owner_user_id is null) then
      alter table public.stores alter column owner_user_id set not null;
    end if;
  end if;
end $$;

create or replace function public.auth_workspace_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select members.workspace_id
  from public.workspace_members members
  where members.user_id = auth.uid()
    and coalesce(members.status, 'active') = 'active';
$$;

create or replace function public.workspace_member_role(candidate_workspace_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select members.role
  from public.workspace_members members
  where members.workspace_id = candidate_workspace_id
    and members.user_id = auth.uid()
    and coalesce(members.status, 'active') = 'active'
  order by case members.role
    when 'owner' then 1
    when 'admin' then 2
    when 'editor' then 3
    when 'support' then 4
    else 5
  end
  limit 1;
$$;

grant execute on function public.auth_workspace_ids() to authenticated;
grant execute on function public.workspace_member_role(uuid) to authenticated;

do $$
begin
  if to_regclass('public.stores') is not null then
    alter table public.stores enable row level security;

    drop policy if exists "store owners and workspace members can view stores" on public.stores;
    drop policy if exists "workspace members can view stores" on public.stores;
    drop policy if exists "workspace editors can create stores" on public.stores;
    drop policy if exists "workspace editors can update stores" on public.stores;
    drop policy if exists "workspace editors can delete stores" on public.stores;

    create policy "workspace members can view stores"
    on public.stores
    for select
    to authenticated
    using (
      public.can_access_workspace(workspace_id)
      or public.shastore_is_admin()
    );

    create policy "workspace editors can create stores"
    on public.stores
    for insert
    to authenticated
    with check (
      public.workspace_can_edit(workspace_id)
      and owner_user_id = auth.uid()
    );

    create policy "workspace editors can update stores"
    on public.stores
    for update
    to authenticated
    using (public.workspace_can_edit(workspace_id))
    with check (
      public.workspace_can_edit(workspace_id)
      and workspace_id is not null
    );

    create policy "workspace editors can delete stores"
    on public.stores
    for delete
    to authenticated
    using (public.workspace_can_edit(workspace_id));
  end if;
end $$;
