-- Workspace member permission overrides.
-- Additive only: keeps existing roles and RLS while allowing per-member deny overrides.

alter table public.workspace_members
  add column if not exists permission_overrides jsonb not null default '{}'::jsonb;

update public.workspace_members
set permission_overrides = '{}'::jsonb
where permission_overrides is null
   or jsonb_typeof(permission_overrides) <> 'object';

create index if not exists workspace_members_permission_overrides_idx
on public.workspace_members using gin (permission_overrides);
