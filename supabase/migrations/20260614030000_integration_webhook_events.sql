-- Integration webhook monitoring events.
-- Additive only: Super Admin observability for webhook receipt and processing.
-- No provider mutation, webhook replay, retry execution, or raw secret storage.

create extension if not exists "pgcrypto";

create table if not exists public.integration_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider_key text not null,
  webhook_type text not null,
  event_type text not null,
  status text not null default 'received',
  http_status integer null,
  attempts integer not null default 1,
  last_attempt_at timestamptz not null default now(),
  next_retry_at timestamptz null,
  processed_at timestamptz null,
  error_code text null,
  error_message text null,
  related_entity_type text null,
  related_entity_id text null,
  safe_payload_summary jsonb null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'integration_webhook_events_status_check'
      and conrelid = 'public.integration_webhook_events'::regclass
  ) then
    alter table public.integration_webhook_events
      add constraint integration_webhook_events_status_check
      check (status in ('received', 'processed', 'failed', 'ignored', 'retry_pending'));
  end if;
end $$;

create index if not exists integration_webhook_events_provider_created_idx
on public.integration_webhook_events(provider_key, created_at desc);

create index if not exists integration_webhook_events_status_created_idx
on public.integration_webhook_events(status, created_at desc);

create index if not exists integration_webhook_events_type_created_idx
on public.integration_webhook_events(event_type, created_at desc);

create index if not exists integration_webhook_events_related_idx
on public.integration_webhook_events(related_entity_type, related_entity_id);

create or replace function public.set_integration_webhook_events_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_integration_webhook_events_updated_at on public.integration_webhook_events;
create trigger set_integration_webhook_events_updated_at
before update on public.integration_webhook_events
for each row
execute function public.set_integration_webhook_events_updated_at();

alter table public.integration_webhook_events enable row level security;

drop policy if exists "service role can manage integration webhook events" on public.integration_webhook_events;
create policy "service role can manage integration webhook events"
on public.integration_webhook_events
for all
to service_role
using (true)
with check (true);
