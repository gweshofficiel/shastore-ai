create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_id_created_at_idx
  on public.notifications(user_id, created_at desc);

create index if not exists notifications_user_id_read_at_idx
  on public.notifications(user_id, read_at)
  where read_at is null;

alter table public.notifications enable row level security;

drop policy if exists "Users can read own notifications" on public.notifications;
drop policy if exists "Users can update own notifications" on public.notifications;
drop policy if exists "Service role can insert notifications" on public.notifications;

create policy "Users can read own notifications"
on public.notifications
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can update own notifications"
on public.notifications
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Service role can insert notifications"
on public.notifications
for insert
to service_role
with check (true);

grant select, update on public.notifications to authenticated;
grant insert on public.notifications to service_role;
