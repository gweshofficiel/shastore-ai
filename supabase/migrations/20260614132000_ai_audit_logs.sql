-- AI audit logs.
-- Additive only: centralized safe metadata for AI runtime events.
-- No provider mutation, AI generation behavior changes, raw prompts, raw provider responses, or secret storage.

create extension if not exists "pgcrypto";

create table if not exists public.ai_audit_logs (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  provider_key text null,
  job_id text null,
  store_id uuid null,
  user_id uuid null references auth.users(id) on delete set null,
  workspace_id uuid null,
  asset_type text null,
  status text not null,
  error_code text null,
  error_message text null,
  safe_summary jsonb null,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ai_audit_logs_event_type_check'
      and conrelid = 'public.ai_audit_logs'::regclass
  ) then
    alter table public.ai_audit_logs
      add constraint ai_audit_logs_event_type_check
      check (event_type in (
        'ai_job_requested',
        'ai_job_queued',
        'ai_job_started',
        'ai_job_completed',
        'ai_job_failed',
        'ai_job_cancelled',
        'ai_asset_created',
        'ai_asset_published',
        'ai_asset_review_marked',
        'ai_asset_review_cleared'
      ));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ai_audit_logs_status_check'
      and conrelid = 'public.ai_audit_logs'::regclass
  ) then
    alter table public.ai_audit_logs
      add constraint ai_audit_logs_status_check
      check (status in ('started', 'success', 'failed', 'skipped', 'blocked'));
  end if;
end $$;

create index if not exists ai_audit_logs_created_idx
on public.ai_audit_logs(created_at desc);

create index if not exists ai_audit_logs_provider_created_idx
on public.ai_audit_logs(provider_key, created_at desc);

create index if not exists ai_audit_logs_status_created_idx
on public.ai_audit_logs(status, created_at desc);

create index if not exists ai_audit_logs_event_type_created_idx
on public.ai_audit_logs(event_type, created_at desc);

create index if not exists ai_audit_logs_store_created_idx
on public.ai_audit_logs(store_id, created_at desc);

alter table public.ai_audit_logs enable row level security;

drop policy if exists "service role can manage ai audit logs" on public.ai_audit_logs;
create policy "service role can manage ai audit logs"
on public.ai_audit_logs
for all
to service_role
using (true)
with check (true);
