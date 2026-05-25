-- Fix workspace member roster visibility for all roles in a shared workspace.
-- RLS SELECT previously relied on can_access_workspace() reading workspace_members
-- from inside a workspace_members policy, which can under-return co-member rows.
-- auth_workspace_ids() runs as SECURITY DEFINER and returns every workspace the
-- current user belongs to, so owners/admins/editors/support can read the full roster.

create or replace function public.auth_workspace_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select members.workspace_id
  from public.workspace_members members
  where members.user_id = auth.uid();
$$;

revoke all on function public.auth_workspace_ids() from public;
grant execute on function public.auth_workspace_ids() to authenticated;

create or replace function public.can_access_workspace(candidate_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.auth_workspace_ids() as workspace_ids(workspace_id)
    where workspace_ids.workspace_id = candidate_workspace_id
  )
  or public.shastore_is_admin();
$$;

revoke all on function public.can_access_workspace(uuid) from public;
grant execute on function public.can_access_workspace(uuid) to authenticated;

drop policy if exists "workspace members can read own workspace members" on public.workspace_members;
drop policy if exists "workspace members can read workspace roster" on public.workspace_members;

create policy "workspace members can read workspace roster"
on public.workspace_members
for select
to authenticated
using (
  workspace_id in (
    select workspace_ids.workspace_id
    from public.auth_workspace_ids() as workspace_ids(workspace_id)
  )
  or public.shastore_is_admin()
);
