-- Workspace member status foundation.
-- Keeps existing memberships active while preparing suspension/ban workflows.

alter table public.workspace_members
  add column if not exists status text not null default 'active'
  check (status in ('active', 'pending', 'suspended', 'banned'));

create index if not exists workspace_members_workspace_status_idx
  on public.workspace_members(workspace_id, status, role, created_at desc);

update public.workspace_members
set status = 'active'
where status is null;

drop policy if exists "workspace managers can update member status" on public.workspace_members;

create policy "workspace managers can update member status"
on public.workspace_members
for update
to authenticated
using (public.can_manage_workspace(workspace_id))
with check (public.can_manage_workspace(workspace_id));
