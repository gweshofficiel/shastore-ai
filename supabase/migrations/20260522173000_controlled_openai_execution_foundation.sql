-- Controlled OpenAI execution foundation.
-- Additive only: records controlled execution attempts, logs, and validations for
-- AI storefront customization without direct publishing, direct theme overwrite,
-- unsafe schema injection, checkout/payments, products, reseller, provisioning,
-- domains, tenant routing, or storefront rendering changes.

create extension if not exists "pgcrypto";

create table if not exists public.ai_execution_logs (
  id uuid primary key default gen_random_uuid(),
  store_instance_id uuid not null references public.store_instances(id) on delete cascade,
  owner_user_id uuid references auth.users(id) on delete cascade,
  customization_id uuid references public.ai_template_customizations(id) on delete set null,
  provider_id uuid references public.ai_providers(id) on delete set null,
  execution_scope text not null default 'template_customization'
    check (execution_scope in ('template_customization', 'store_generation', 'copywriting', 'seo', 'translation')),
  execution_status text not null default 'prepared'
    check (execution_status in ('prepared', 'running', 'succeeded', 'failed', 'blocked', 'archived')),
  prompt_preview text not null default '',
  safe_actions jsonb not null default '[]'::jsonb,
  blocked_actions jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_execution_attempts (
  id uuid primary key default gen_random_uuid(),
  execution_log_id uuid not null references public.ai_execution_logs(id) on delete cascade,
  store_instance_id uuid not null references public.store_instances(id) on delete cascade,
  owner_user_id uuid references auth.users(id) on delete cascade,
  provider_id uuid references public.ai_providers(id) on delete set null,
  provider_config_id uuid references public.ai_provider_configs(id) on delete set null,
  attempt_number integer not null default 1,
  attempt_status text not null default 'prepared'
    check (attempt_status in ('prepared', 'running', 'succeeded', 'failed', 'timeout', 'blocked')),
  model_key text not null default 'gpt-4o-mini',
  request_payload jsonb not null default '{}'::jsonb,
  response_payload jsonb not null default '{}'::jsonb,
  sanitized_payload jsonb not null default '{}'::jsonb,
  token_usage jsonb not null default '{"input":0,"output":0,"total":0}'::jsonb,
  retry_state jsonb not null default '{"canRetry":true,"nextDelaySeconds":30}'::jsonb,
  error_message text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_response_validations (
  id uuid primary key default gen_random_uuid(),
  execution_attempt_id uuid references public.ai_execution_attempts(id) on delete cascade,
  execution_log_id uuid references public.ai_execution_logs(id) on delete cascade,
  store_instance_id uuid not null references public.store_instances(id) on delete cascade,
  owner_user_id uuid references auth.users(id) on delete cascade,
  validation_status text not null default 'pending'
    check (validation_status in ('pending', 'valid', 'invalid', 'sanitized', 'blocked')),
  validation_errors jsonb not null default '[]'::jsonb,
  allowed_fields jsonb not null default '[]'::jsonb,
  blocked_fields jsonb not null default '[]'::jsonb,
  sanitized_output jsonb not null default '{}'::jsonb,
  mapped_draft_preview jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_execution_logs_store_idx
  on public.ai_execution_logs(store_instance_id, execution_status, created_at desc);

create index if not exists ai_execution_attempts_log_idx
  on public.ai_execution_attempts(execution_log_id, attempt_number desc);

create index if not exists ai_response_validations_log_idx
  on public.ai_response_validations(execution_log_id, created_at desc);

alter table public.ai_execution_logs enable row level security;
alter table public.ai_execution_attempts enable row level security;
alter table public.ai_response_validations enable row level security;

do $$
declare
  managed_table text;
begin
  foreach managed_table in array array[
    'ai_execution_logs',
    'ai_execution_attempts',
    'ai_response_validations'
  ]
  loop
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = managed_table
        and policyname = 'Buyer store members read controlled AI execution records'
    ) then
      execute format(
        'create policy "Buyer store members read controlled AI execution records" on public.%I for select using (public.can_access_store_instance(store_instance_id))',
        managed_table
      );
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = managed_table
        and policyname = 'Buyer store managers write controlled AI execution records'
    ) then
      execute format(
        'create policy "Buyer store managers write controlled AI execution records" on public.%I for all using (public.can_manage_store_instance(store_instance_id)) with check (public.can_manage_store_instance(store_instance_id))',
        managed_table
      );
    end if;
  end loop;
end $$;
