alter table public.notifications
  add column if not exists workspace_id uuid,
  add column if not exists store_id uuid,
  add column if not exists status text not null default 'unread';

alter table public.notifications
  alter column metadata set default '{}'::jsonb;

update public.notifications
set status = case when read_at is null then 'unread' else 'read' end
where status is null
   or status not in ('unread', 'read');

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'notifications_status_check'
      and conrelid = 'public.notifications'::regclass
  ) then
    alter table public.notifications
      add constraint notifications_status_check
      check (status in ('unread', 'read'));
  end if;
end $$;

create index if not exists notifications_workspace_created_at_idx
  on public.notifications(workspace_id, created_at desc)
  where workspace_id is not null;

create index if not exists notifications_workspace_unread_idx
  on public.notifications(workspace_id, status, created_at desc)
  where workspace_id is not null and status = 'unread';

create index if not exists notifications_store_created_at_idx
  on public.notifications(store_id, created_at desc)
  where store_id is not null;

drop policy if exists "Users can read own notifications" on public.notifications;
drop policy if exists "Users can update own notifications" on public.notifications;
drop policy if exists "Service role can insert notifications" on public.notifications;
drop policy if exists "workspace members read notifications" on public.notifications;
drop policy if exists "workspace members update notifications" on public.notifications;

create policy "workspace members read notifications"
on public.notifications
for select
to authenticated
using (
  auth.uid() = user_id
  or (
    workspace_id is not null
    and public.can_access_workspace(workspace_id)
  )
);

create policy "workspace members update notifications"
on public.notifications
for update
to authenticated
using (
  auth.uid() = user_id
  or (
    workspace_id is not null
    and public.can_access_workspace(workspace_id)
  )
)
with check (
  auth.uid() = user_id
  or (
    workspace_id is not null
    and public.can_access_workspace(workspace_id)
  )
);

create policy "Service role can insert notifications"
on public.notifications
for insert
to service_role
with check (true);

grant select, update on public.notifications to authenticated;
grant insert on public.notifications to service_role;
