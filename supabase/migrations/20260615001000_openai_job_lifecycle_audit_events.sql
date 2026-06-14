-- Unified OpenAI job lifecycle audit events.
-- Additive constraint extension only; RLS and existing audit data remain unchanged.

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
