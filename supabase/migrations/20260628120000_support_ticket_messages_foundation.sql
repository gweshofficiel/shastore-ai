-- Platform support ticket conversation foundation (SP-7).
-- Additive only: threaded messages for platform support_tickets.

create table if not exists public.support_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  workspace_id uuid,
  store_id uuid references public.stores(id) on delete set null,
  author_user_id uuid references auth.users(id) on delete set null,
  author_role text not null check (author_role in ('customer', 'support_agent', 'super_admin', 'system')),
  author_label text not null,
  message_body text not null,
  visibility text not null default 'internal' check (visibility in ('customer', 'internal', 'super_admin')),
  has_attachments boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists support_ticket_messages_ticket_created_idx
on public.support_ticket_messages(ticket_id, created_at asc);

alter table public.support_ticket_messages enable row level security;

drop policy if exists "support ticket creators read own ticket messages" on public.support_ticket_messages;
drop policy if exists "workspace support members read support ticket messages" on public.support_ticket_messages;
drop policy if exists "platform admins manage support ticket messages" on public.support_ticket_messages;
drop policy if exists "service role manages support ticket messages" on public.support_ticket_messages;

create policy "support ticket creators read own ticket messages"
on public.support_ticket_messages
for select
to authenticated
using (
  exists (
    select 1
    from public.support_tickets ticket
    where ticket.id = support_ticket_messages.ticket_id
      and ticket.user_id = auth.uid()
  )
);

create policy "workspace support members read support ticket messages"
on public.support_ticket_messages
for select
to authenticated
using (
  exists (
    select 1
    from public.support_tickets ticket
    where ticket.id = support_ticket_messages.ticket_id
      and ticket.workspace_id is not null
      and public.is_workspace_support_member(auth.uid(), ticket.workspace_id)
  )
);

create policy "platform admins manage support ticket messages"
on public.support_ticket_messages
for all
to authenticated
using (public.is_platform_admin(auth.uid()))
with check (public.is_platform_admin(auth.uid()));

create policy "service role manages support ticket messages"
on public.support_ticket_messages
for all
to service_role
using (true)
with check (true);

revoke all on public.support_ticket_messages from anon;
revoke all on public.support_ticket_messages from authenticated;

grant select, insert, update, delete on public.support_ticket_messages to authenticated;
grant all on public.support_ticket_messages to service_role;
