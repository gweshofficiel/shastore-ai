-- AI error events.
-- Additive only: aggregated safe metadata for Super Admin AI Error Center.
-- No provider calls, generation changes, raw prompts, raw provider responses, private URLs, or secrets.

create extension if not exists "pgcrypto";

create table if not exists public.ai_error_events (
  id uuid primary key default gen_random_uuid(),
  provider text null,
  job_id text null,
  store_id uuid null,
  asset_type text null,
  error_group text not null,
  error_code text null,
  error_message text null,
  severity text not null,
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  occurrences integer not null default 1,
  aggregation_key text not null,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ai_error_events_error_group_check'
      and conrelid = 'public.ai_error_events'::regclass
  ) then
    alter table public.ai_error_events
      add constraint ai_error_events_error_group_check
      check (error_group in (
        'PROVIDER_ERROR',
        'STORAGE_ERROR',
        'TIMEOUT_ERROR',
        'MODERATION_ERROR',
        'VALIDATION_ERROR',
        'UNKNOWN_ERROR'
      ));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ai_error_events_severity_check'
      and conrelid = 'public.ai_error_events'::regclass
  ) then
    alter table public.ai_error_events
      add constraint ai_error_events_severity_check
      check (severity in ('low', 'medium', 'high', 'critical'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ai_error_events_occurrences_positive_check'
      and conrelid = 'public.ai_error_events'::regclass
  ) then
    alter table public.ai_error_events
      add constraint ai_error_events_occurrences_positive_check
      check (occurrences > 0);
  end if;
end $$;

create unique index if not exists ai_error_events_aggregation_key_idx
on public.ai_error_events(aggregation_key);

create index if not exists ai_error_events_last_seen_idx
on public.ai_error_events(last_seen_at desc);

create index if not exists ai_error_events_provider_last_seen_idx
on public.ai_error_events(provider, last_seen_at desc);

create index if not exists ai_error_events_group_last_seen_idx
on public.ai_error_events(error_group, last_seen_at desc);

create index if not exists ai_error_events_severity_last_seen_idx
on public.ai_error_events(severity, last_seen_at desc);

create index if not exists ai_error_events_store_last_seen_idx
on public.ai_error_events(store_id, last_seen_at desc);

alter table public.ai_error_events enable row level security;

drop policy if exists "service role can manage ai error events" on public.ai_error_events;
create policy "service role can manage ai error events"
on public.ai_error_events
for all
to service_role
using (true)
with check (true);
