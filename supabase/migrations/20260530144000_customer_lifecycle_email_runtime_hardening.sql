-- Customer lifecycle email automation runtime hardening.
-- Additive only: lifecycle events keep delivery metadata and continue to feed email_event_logs.

alter table public.customer_lifecycle_events
  add column if not exists recipient text,
  add column if not exists customer_name text,
  add column if not exists order_source text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists customer_lifecycle_events_event_due_idx
on public.customer_lifecycle_events(workspace_id, store_id, event_type, scheduled_for)
where processed_at is null;
