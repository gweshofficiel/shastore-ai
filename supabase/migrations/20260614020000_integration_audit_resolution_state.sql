-- Integration audit resolution state.
-- Additive only: enables Super Admin error-center triage without provider mutation.

alter table public.integration_audit_logs
  add column if not exists resolved_at timestamptz null,
  add column if not exists resolved_by uuid null references auth.users(id) on delete set null,
  add column if not exists resolution_note text null;

create index if not exists integration_audit_logs_resolution_created_idx
on public.integration_audit_logs(resolved_at, created_at desc);
