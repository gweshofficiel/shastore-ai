-- Stores insert RLS: align workspace helpers with personal workspace (workspace_id = auth.uid()).
-- Additive only: does not disable RLS or allow anonymous store creation.

create or replace function public.can_access_workspace(candidate_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members members
    where members.workspace_id = candidate_workspace_id
      and members.user_id = auth.uid()
      and coalesce(members.status, 'active') = 'active'
  )
  or candidate_workspace_id = auth.uid()
  or public.shastore_is_admin();
$$;

create or replace function public.workspace_can_edit(candidate_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.workspace_member_role(candidate_workspace_id), '') in ('owner', 'admin', 'editor')
    or candidate_workspace_id = auth.uid()
    or public.shastore_is_admin();
$$;

grant execute on function public.can_access_workspace(uuid) to authenticated;
grant execute on function public.workspace_can_edit(uuid) to authenticated;

-- Backfill owner roster rows used by workspace_can_edit for existing stores.
insert into public.workspace_members (workspace_id, user_id, role, invited_by, status)
select distinct stores.workspace_id, stores.owner_user_id, 'owner', stores.owner_user_id, 'active'
from public.stores stores
where stores.workspace_id is not null
  and stores.owner_user_id is not null
on conflict (workspace_id, user_id) do nothing;

do $$
begin
  if to_regclass('public.stores') is null then
    return;
  end if;

  alter table public.stores enable row level security;

  drop policy if exists "store owners can insert own stores" on public.stores;
  create policy "store owners can insert own stores"
  on public.stores
  for insert
  to authenticated
  with check (
    auth.uid() = owner_user_id
    and auth.uid() = user_id
    and (
      workspace_id = auth.uid()
      or public.workspace_can_edit(workspace_id)
    )
  );

  drop policy if exists "workspace editors can create stores" on public.stores;
  create policy "workspace editors can create stores"
  on public.stores
  for insert
  to authenticated
  with check (
    public.workspace_can_edit(workspace_id)
    and owner_user_id = auth.uid()
    and user_id = auth.uid()
  );

  drop policy if exists "workspace members can view stores" on public.stores;
  create policy "workspace members can view stores"
  on public.stores
  for select
  to authenticated
  using (
    public.can_access_workspace(workspace_id)
    or auth.uid() = owner_user_id
    or public.shastore_is_admin()
  );
end $$;
