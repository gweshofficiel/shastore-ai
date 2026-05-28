-- Email retry and failed delivery recovery foundation.
-- Additive metadata plus retry-aware status support.

alter table public.email_event_logs
  add column if not exists retry_count integer not null default 0,
  add column if not exists last_error text,
  add column if not exists next_retry_at timestamptz;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'email_event_logs_status_check'
      and conrelid = 'public.email_event_logs'::regclass
  ) then
    alter table public.email_event_logs
      drop constraint email_event_logs_status_check;
  end if;

  alter table public.email_event_logs
    add constraint email_event_logs_status_check
    check (status in ('pending', 'sent', 'retry_pending', 'failed'));
end $$;

create index if not exists email_event_logs_retry_due_idx
on public.email_event_logs(workspace_id, store_id, next_retry_at)
where status = 'retry_pending' and resend_message_id is null;

drop function if exists public.claim_pending_email_events(uuid, uuid, integer, text);

create or replace function public.claim_pending_email_events(
  target_workspace_id uuid,
  target_store_id uuid default null,
  batch_limit integer default 10,
  worker_id text default null
)
returns table (
  id uuid,
  workspace_id uuid,
  store_id uuid,
  recipient text,
  subject text,
  template_key text,
  metadata jsonb,
  attempt_count integer,
  retry_count integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with candidates as (
    select logs.id
    from public.email_event_logs logs
    where logs.workspace_id = target_workspace_id
      and (target_store_id is null or logs.store_id = target_store_id)
      and logs.status in ('pending', 'retry_pending')
      and logs.resend_message_id is null
      and logs.retry_count <= 3
      and (
        logs.status = 'pending'
        or logs.next_retry_at is null
        or logs.next_retry_at <= now()
      )
      and (
        logs.locked_at is null
        or logs.locked_at < now() - interval '15 minutes'
      )
    order by coalesce(logs.next_retry_at, logs.created_at) asc
    limit greatest(1, least(coalesce(batch_limit, 10), 50))
    for update skip locked
  )
  update public.email_event_logs logs
  set
    attempt_count = logs.attempt_count + 1,
    last_attempt_at = now(),
    locked_at = now(),
    locked_by = coalesce(nullif(worker_id, ''), 'store-email-worker'),
    provider = 'resend',
    status = 'pending',
    updated_at = now()
  from candidates
  where logs.id = candidates.id
  returning
    logs.id,
    logs.workspace_id,
    logs.store_id,
    logs.recipient,
    logs.subject,
    logs.template_key,
    logs.metadata,
    logs.attempt_count,
    logs.retry_count;
end;
$$;

revoke all on function public.claim_pending_email_events(uuid, uuid, integer, text) from public;
revoke all on function public.claim_pending_email_events(uuid, uuid, integer, text) from anon;
revoke all on function public.claim_pending_email_events(uuid, uuid, integer, text) from authenticated;
grant execute on function public.claim_pending_email_events(uuid, uuid, integer, text) to service_role;
