-- OpenAI production monitoring audit events.
-- Additive only: no billing, auth, store management, provider execution, or RLS changes.

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
  'openai_production_monitoring_loaded',
  'openai_incident_detected',
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
