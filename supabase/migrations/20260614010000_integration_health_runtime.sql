-- Integration runtime health state.
-- Additive only: Super Admin observability for safe manual health checks.
-- No provider mutation, billing actions, customer-facing access, or secret storage.

create extension if not exists "pgcrypto";

create table if not exists public.integration_health_states (
  id uuid primary key default gen_random_uuid(),
  provider_key text not null unique,
  provider_name text not null,
  category text not null,
  status text not null default 'not_checked',
  enabled boolean not null default false,
  configured boolean not null default false,
  mode text not null default 'placeholder',
  last_checked_at timestamptz,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  response_time_ms integer,
  failure_count integer not null default 0,
  consecutive_failures integer not null default 0,
  last_error_code text,
  last_error_message text,
  last_safe_response_summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'integration_health_states_status_check'
      and conrelid = 'public.integration_health_states'::regclass
  ) then
    alter table public.integration_health_states
      add constraint integration_health_states_status_check
      check (status in (
        'not_checked',
        'healthy',
        'degraded',
        'failed',
        'disabled',
        'missing_config',
        'placeholder'
      ));
  end if;
end $$;

create index if not exists integration_health_states_category_idx
on public.integration_health_states(category, provider_key);

create index if not exists integration_health_states_status_idx
on public.integration_health_states(status, last_checked_at desc);

create or replace function public.set_integration_health_states_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_integration_health_states_updated_at on public.integration_health_states;
create trigger set_integration_health_states_updated_at
before update on public.integration_health_states
for each row
execute function public.set_integration_health_states_updated_at();

alter table public.integration_health_states enable row level security;

drop policy if exists "service role can manage integration health states" on public.integration_health_states;
create policy "service role can manage integration health states"
on public.integration_health_states
for all
to service_role
using (true)
with check (true);
