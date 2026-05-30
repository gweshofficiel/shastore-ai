create extension if not exists "pgcrypto";

create table if not exists public.security_audit_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid null,
  store_id uuid null,
  user_id uuid null references auth.users(id) on delete set null,
  action text not null,
  reason text not null,
  route text null,
  ip_address text null,
  user_agent text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists security_audit_logs_workspace_created_at_idx
on public.security_audit_logs(workspace_id, created_at desc);

create index if not exists security_audit_logs_store_created_at_idx
on public.security_audit_logs(store_id, created_at desc);

create index if not exists security_audit_logs_user_created_at_idx
on public.security_audit_logs(user_id, created_at desc);

create index if not exists security_audit_logs_action_created_at_idx
on public.security_audit_logs(action, created_at desc);

alter table public.security_audit_logs enable row level security;

drop policy if exists "security audit workspace members can read own logs" on public.security_audit_logs;
drop policy if exists "security audit store owners can read own logs" on public.security_audit_logs;
drop policy if exists "security audit service role inserts logs" on public.security_audit_logs;

create policy "security audit workspace members can read own logs"
on public.security_audit_logs
for select
to authenticated
using (
  workspace_id is not null
  and (
    workspace_id = auth.uid()
    or exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = security_audit_logs.workspace_id
        and wm.user_id = auth.uid()
        and coalesce(wm.status, 'active') = 'active'
    )
  )
);

create policy "security audit store owners can read own logs"
on public.security_audit_logs
for select
to authenticated
using (
  store_id is not null
  and exists (
    select 1
    from public.stores s
    where s.id = security_audit_logs.store_id
      and (s.owner_user_id = auth.uid() or s.user_id = auth.uid())
  )
);

create policy "security audit service role inserts logs"
on public.security_audit_logs
for insert
to service_role
with check (true);

grant select on public.security_audit_logs to authenticated;
grant insert on public.security_audit_logs to service_role;
