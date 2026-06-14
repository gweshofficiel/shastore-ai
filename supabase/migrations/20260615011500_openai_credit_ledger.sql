-- OpenAI credit ledger.
-- Additive only: no payment, subscription, global billing, pricing, or existing RLS changes.

create extension if not exists "pgcrypto";

create table if not exists public.openai_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  job_id text not null,
  idempotency_key text not null,
  operation text not null,
  status text not null,
  provider_key text not null default 'openai',
  asset_type text null,
  store_id uuid null,
  user_id uuid null references auth.users(id) on delete set null,
  workspace_id uuid null,
  amount integer not null default 0,
  balance_before integer null,
  balance_after integer null,
  reference_id uuid null references public.openai_credit_ledger(id) on delete set null,
  error_code text null,
  safe_error_message text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint openai_credit_ledger_operation_check
    check (operation in ('reservation', 'deduction', 'refund', 'adjustment')),
  constraint openai_credit_ledger_status_check
    check (status in ('reserved', 'charged', 'refunded', 'released', 'blocked', 'failed', 'skipped')),
  constraint openai_credit_ledger_amount_check
    check (amount >= 0)
);

create unique index if not exists openai_credit_ledger_idempotency_idx
on public.openai_credit_ledger(idempotency_key);

create index if not exists openai_credit_ledger_job_idx
on public.openai_credit_ledger(job_id, created_at desc);

create index if not exists openai_credit_ledger_user_created_idx
on public.openai_credit_ledger(user_id, created_at desc);

create index if not exists openai_credit_ledger_status_created_idx
on public.openai_credit_ledger(status, created_at desc);

create index if not exists openai_credit_ledger_store_created_idx
on public.openai_credit_ledger(store_id, created_at desc);

create or replace function public.set_openai_credit_ledger_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists openai_credit_ledger_updated_at on public.openai_credit_ledger;
create trigger openai_credit_ledger_updated_at
before update on public.openai_credit_ledger
for each row execute function public.set_openai_credit_ledger_updated_at();

alter table public.openai_credit_ledger enable row level security;

drop policy if exists "service role can manage openai credit ledger" on public.openai_credit_ledger;
create policy "service role can manage openai credit ledger"
on public.openai_credit_ledger
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
