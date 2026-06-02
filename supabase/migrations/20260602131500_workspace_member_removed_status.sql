-- Workspace member removed status.
-- Additive only: preserve staff history while blocking removed members from access.

alter table public.workspace_members
  add column if not exists status text not null default 'active';

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'workspace_members_status_check'
      and conrelid = 'public.workspace_members'::regclass
  ) then
    alter table public.workspace_members
      drop constraint workspace_members_status_check;
  end if;
end $$;

alter table public.workspace_members
  add constraint workspace_members_status_check
  check (status in ('active', 'pending', 'suspended', 'banned', 'removed'));

create index if not exists workspace_members_workspace_removed_idx
on public.workspace_members(workspace_id, status, created_at desc)
where status = 'removed';
