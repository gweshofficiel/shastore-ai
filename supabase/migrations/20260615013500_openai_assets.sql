-- OpenAI asset persistence and export runtime.
-- Additive only: no payment, subscription, billing, store-management, provider, or existing RLS changes.

create extension if not exists "pgcrypto";

create table if not exists public.openai_assets (
  id uuid primary key default gen_random_uuid(),
  job_id text not null,
  provider_key text not null default 'openai',
  asset_type text null,
  status text not null,
  store_id uuid null,
  user_id uuid null references auth.users(id) on delete set null,
  workspace_id uuid null,
  source_kind text not null default 'openai_job',
  storage_provider text null,
  storage_status text not null default 'unknown',
  storage_reference_hash text null,
  content_type text null,
  width integer null,
  height integer null,
  target_type text null,
  target_id text null,
  slot text null,
  export_status text not null default 'not_prepared',
  export_prepared_at timestamptz null,
  safe_metadata jsonb not null default '{}'::jsonb,
  error_code text null,
  safe_error_message text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint openai_assets_status_check
    check (status in ('generated', 'stored', 'storage_failed', 'ready_for_review', 'published', 'export_ready', 'export_failed')),
  constraint openai_assets_storage_status_check
    check (storage_status in ('not_applicable', 'pending', 'stored', 'failed', 'unknown')),
  constraint openai_assets_export_status_check
    check (export_status in ('not_prepared', 'export_ready', 'export_failed'))
);

create unique index if not exists openai_assets_job_idx
on public.openai_assets(job_id);

create index if not exists openai_assets_status_created_idx
on public.openai_assets(status, created_at desc);

create index if not exists openai_assets_store_created_idx
on public.openai_assets(store_id, created_at desc);

create index if not exists openai_assets_export_status_idx
on public.openai_assets(export_status, created_at desc);

create or replace function public.set_openai_assets_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists openai_assets_updated_at on public.openai_assets;
create trigger openai_assets_updated_at
before update on public.openai_assets
for each row execute function public.set_openai_assets_updated_at();

alter table public.openai_assets enable row level security;

drop policy if exists "service role can manage openai assets" on public.openai_assets;
create policy "service role can manage openai assets"
on public.openai_assets
for all
to service_role
using (true)
with check (true);

alter table public.ai_audit_logs
drop constraint if exists ai_audit_logs_event_type_check;

alter table public.ai_audit_logs
add constraint ai_audit_logs_event_type_check
check (event_type in (
  'ai_job_requested',
  'ai_job_created',
  'ai_job_queued',
  'ai_job_started',
  'ai_job_completed',
  'ai_job_failed',
  'ai_job_cancelled',
  'ai_job_timeout',
  'ai_job_retry_pending',
  'openai_executor_started',
  'openai_job_created',
  'openai_job_locked',
  'openai_job_running',
  'openai_call_started',
  'openai_call_completed',
  'openai_asset_stored',
  'openai_job_completed',
  'openai_job_failed',
  'openai_timeout_detected',
  'openai_executor_finished',
  'openai_credit_check_started',
  'openai_credit_reserved',
  'openai_credit_deducted',
  'openai_credit_refunded',
  'openai_credit_blocked_insufficient',
  'openai_asset_persistence_started',
  'openai_asset_persisted',
  'openai_asset_storage_failed',
  'openai_asset_export_prepared',
  'openai_asset_export_failed',
  'ai_asset_created',
  'ai_asset_published',
  'ai_asset_review_marked',
  'ai_asset_review_cleared',
  'ai_diagnostic_started',
  'ai_diagnostic_success',
  'ai_diagnostic_failed',
  'ai_diagnostic_skipped',
  'ai_secret_rotation_required',
  'ai_secret_marked_rotated',
  'ai_queue_monitor_viewed',
  'ai_stale_job_detected'
));
