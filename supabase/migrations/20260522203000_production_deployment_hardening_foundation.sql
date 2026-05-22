-- Production deployment and environment hardening foundation.
-- Additive only: prepares deployment health, runtime environment validation,
-- deployment logs, and feature flags without changing products, orders, checkout,
-- reseller, provisioning, storefront rendering core, builder architecture, or AI core.

create extension if not exists "pgcrypto";

create table if not exists public.deployment_health_checks (
  id uuid primary key default gen_random_uuid(),
  store_instance_id uuid references public.store_instances(id) on delete cascade,
  owner_user_id uuid references auth.users(id) on delete cascade,
  check_scope text not null default 'platform'
    check (check_scope in ('platform', 'supabase', 'openai', 'domains', 'hostname', 'builder', 'preview', 'ai', 'middleware', 'cache')),
  check_key text not null,
  check_status text not null default 'pending'
    check (check_status in ('pending', 'healthy', 'degraded', 'blocked', 'failed')),
  check_payload jsonb not null default '{}'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  blocking_errors jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.runtime_environment_states (
  id uuid primary key default gen_random_uuid(),
  store_instance_id uuid references public.store_instances(id) on delete cascade,
  owner_user_id uuid references auth.users(id) on delete cascade,
  environment_mode text not null default 'localhost'
    check (environment_mode in ('localhost', 'preview', 'production')),
  runtime_status text not null default 'pending'
    check (runtime_status in ('pending', 'ready', 'degraded', 'blocked')),
  app_base_url text,
  required_env_state jsonb not null default '{}'::jsonb,
  optional_env_state jsonb not null default '{}'::jsonb,
  secret_validation_state jsonb not null default '{}'::jsonb,
  middleware_state jsonb not null default '{}'::jsonb,
  hydration_state jsonb not null default '{}'::jsonb,
  cache_state jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_instance_id, environment_mode)
);

create table if not exists public.deployment_runtime_logs (
  id uuid primary key default gen_random_uuid(),
  store_instance_id uuid references public.store_instances(id) on delete cascade,
  owner_user_id uuid references auth.users(id) on delete cascade,
  log_scope text not null default 'deployment'
    check (log_scope in ('deployment', 'startup', 'middleware', 'server_action', 'health', 'feature_flags', 'cache')),
  log_level text not null default 'info'
    check (log_level in ('debug', 'info', 'warning', 'error')),
  log_key text not null,
  log_payload jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.production_feature_flags (
  id uuid primary key default gen_random_uuid(),
  store_instance_id uuid references public.store_instances(id) on delete cascade,
  owner_user_id uuid references auth.users(id) on delete cascade,
  flag_key text not null,
  flag_scope text not null default 'platform'
    check (flag_scope in ('platform', 'storefront', 'builder', 'preview', 'ai', 'security', 'runtime')),
  flag_enabled boolean not null default false,
  rollout_state text not null default 'prepared'
    check (rollout_state in ('prepared', 'enabled', 'disabled', 'testing', 'blocked')),
  fallback_value jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_instance_id, flag_key)
);

create index if not exists deployment_health_checks_store_idx
  on public.deployment_health_checks(store_instance_id, check_scope, check_status, checked_at desc);

create index if not exists runtime_environment_states_store_idx
  on public.runtime_environment_states(store_instance_id, environment_mode, runtime_status, updated_at desc);

create index if not exists deployment_runtime_logs_store_idx
  on public.deployment_runtime_logs(store_instance_id, log_scope, created_at desc);

create index if not exists production_feature_flags_store_idx
  on public.production_feature_flags(store_instance_id, flag_scope, flag_key);

alter table public.deployment_health_checks enable row level security;
alter table public.runtime_environment_states enable row level security;
alter table public.deployment_runtime_logs enable row level security;
alter table public.production_feature_flags enable row level security;

do $$
declare
  managed_table text;
begin
  foreach managed_table in array array[
    'deployment_health_checks',
    'runtime_environment_states',
    'deployment_runtime_logs',
    'production_feature_flags'
  ]
  loop
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = managed_table
        and policyname = 'Buyer store members read deployment foundation records'
    ) then
      execute format(
        'create policy "Buyer store members read deployment foundation records" on public.%I for select using (store_instance_id is null or public.can_access_store_instance(store_instance_id))',
        managed_table
      );
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = managed_table
        and policyname = 'Buyer store managers write deployment foundation records'
    ) then
      execute format(
        'create policy "Buyer store managers write deployment foundation records" on public.%I for all using (store_instance_id is null or public.can_manage_store_instance(store_instance_id)) with check (store_instance_id is null or public.can_manage_store_instance(store_instance_id))',
        managed_table
      );
    end if;
  end loop;
end $$;
