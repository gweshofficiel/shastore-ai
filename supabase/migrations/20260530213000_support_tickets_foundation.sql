create extension if not exists "pgcrypto";

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid null,
  store_id uuid null references public.stores(id) on delete set null,
  user_id uuid null references auth.users(id) on delete set null,
  event_id uuid null references public.monitoring_events(id) on delete set null,
  ticket_number text not null unique,
  status text not null default 'open'
    check (status in ('open', 'in_review', 'resolved', 'closed')),
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'urgent')),
  subject text not null,
  message text,
  technical_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists support_tickets_workspace_created_idx
on public.support_tickets(workspace_id, created_at desc);

create index if not exists support_tickets_store_created_idx
on public.support_tickets(store_id, created_at desc);

create index if not exists support_tickets_event_idx
on public.support_tickets(event_id);

alter table public.support_tickets enable row level security;

drop policy if exists "support ticket creators read own tickets" on public.support_tickets;
drop policy if exists "workspace support members read support tickets" on public.support_tickets;
drop policy if exists "workspace members create own support tickets" on public.support_tickets;
drop policy if exists "platform admins manage support tickets" on public.support_tickets;
drop policy if exists "service role manages support tickets" on public.support_tickets;

create policy "support ticket creators read own tickets"
on public.support_tickets
for select
to authenticated
using (
  user_id = auth.uid()
  and workspace_id is not null
  and (
    workspace_id = auth.uid()
    or public.can_access_workspace(workspace_id)
  )
);

create policy "workspace support members read support tickets"
on public.support_tickets
for select
to authenticated
using (
  workspace_id is not null
  and public.workspace_member_role(workspace_id) = 'support'
);

create policy "workspace members create own support tickets"
on public.support_tickets
for insert
to authenticated
with check (
  user_id = auth.uid()
  and workspace_id is not null
  and (
    workspace_id = auth.uid()
    or public.can_access_workspace(workspace_id)
  )
);

create policy "platform admins manage support tickets"
on public.support_tickets
for all
to authenticated
using (public.shastore_is_admin())
with check (public.shastore_is_admin());

create policy "service role manages support tickets"
on public.support_tickets
for all
to service_role
using (true)
with check (true);

revoke all on public.support_tickets from anon;
revoke all on public.support_tickets from authenticated;

grant select (
  id,
  workspace_id,
  store_id,
  user_id,
  event_id,
  ticket_number,
  status,
  priority,
  subject,
  message,
  created_at,
  updated_at
) on public.support_tickets to authenticated;

grant insert (
  workspace_id,
  store_id,
  user_id,
  event_id,
  ticket_number,
  status,
  priority,
  subject,
  message,
  technical_snapshot
) on public.support_tickets to authenticated;

grant all on public.support_tickets to service_role;
