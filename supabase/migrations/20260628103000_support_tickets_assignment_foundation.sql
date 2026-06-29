-- Platform support ticket assignment foundation (SP-6).
-- Additive only: optional assignee for platform support_tickets.

alter table public.support_tickets
add column if not exists assigned_user_id uuid references auth.users(id) on delete set null;

create index if not exists support_tickets_assigned_user_idx
on public.support_tickets(assigned_user_id)
where assigned_user_id is not null;
