-- Workspace activity logs foundation.
-- Additive only: preserves existing audit tables and RLS.

create table if not exists public.workspace_activity_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  store_id uuid null,
  actor_user_id uuid null references auth.users(id) on delete set null,
  actor_email text,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists workspace_activity_logs_workspace_created_idx
on public.workspace_activity_logs(workspace_id, created_at desc);

create index if not exists workspace_activity_logs_store_created_idx
on public.workspace_activity_logs(store_id, created_at desc);

create index if not exists workspace_activity_logs_action_created_idx
on public.workspace_activity_logs(action, created_at desc);

create index if not exists workspace_activity_logs_entity_idx
on public.workspace_activity_logs(entity_type, entity_id);

alter table public.workspace_activity_logs enable row level security;

drop policy if exists "workspace members read activity logs" on public.workspace_activity_logs;
drop policy if exists "workspace editors insert activity logs" on public.workspace_activity_logs;
drop policy if exists "service role manages activity logs" on public.workspace_activity_logs;

create policy "workspace members read activity logs"
on public.workspace_activity_logs
for select
to authenticated
using (public.can_access_workspace(workspace_id));

create policy "workspace editors insert activity logs"
on public.workspace_activity_logs
for insert
to authenticated
with check (public.workspace_can_edit(workspace_id));

create policy "service role manages activity logs"
on public.workspace_activity_logs
for all
to service_role
using (true)
with check (true);

grant select, insert on public.workspace_activity_logs to authenticated;
grant all on public.workspace_activity_logs to service_role;
