-- Production security, rate limits, and abuse protection foundation.
-- Additive only: prepares tenant-safe validation, throttling, AI usage limits,
-- mutation logs, and security events without changing products, orders, checkout,
-- reseller, provisioning, hostname/domain systems, storefront rendering core, or
-- launch/publish systems.

create extension if not exists "pgcrypto";

create table if not exists public.request_rate_limits (
  id uuid primary key default gen_random_uuid(),
  store_instance_id uuid references public.store_instances(id) on delete cascade,
  owner_user_id uuid references auth.users(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_key text not null default '',
  action_key text not null,
  request_scope text not null default 'dashboard'
    check (request_scope in ('storefront', 'builder', 'ai', 'preview', 'dashboard', 'api')),
  window_start timestamptz not null default now(),
  window_seconds integer not null default 60 check (window_seconds > 0),
  request_count integer not null default 0 check (request_count >= 0),
  request_limit integer not null default 60 check (request_limit > 0),
  limit_status text not null default 'allowed'
    check (limit_status in ('allowed', 'throttled', 'blocked', 'monitoring')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_usage_limits (
  id uuid primary key default gen_random_uuid(),
  store_instance_id uuid not null references public.store_instances(id) on delete cascade,
  owner_user_id uuid references auth.users(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  usage_scope text not null default 'template_customization'
    check (usage_scope in ('template_customization', 'draft_application', 'provider_execution', 'queue_worker', 'copy_generation')),
  period_start timestamptz not null default now(),
  period_seconds integer not null default 86400 check (period_seconds > 0),
  request_count integer not null default 0 check (request_count >= 0),
  token_count integer not null default 0 check (token_count >= 0),
  request_limit integer not null default 100 check (request_limit > 0),
  token_limit integer not null default 100000 check (token_limit > 0),
  usage_status text not null default 'allowed'
    check (usage_status in ('allowed', 'warning', 'throttled', 'blocked')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.builder_action_logs (
  id uuid primary key default gen_random_uuid(),
  store_instance_id uuid not null references public.store_instances(id) on delete cascade,
  owner_user_id uuid references auth.users(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  builder_page_id uuid references public.builder_pages(id) on delete set null,
  builder_draft_id uuid references public.builder_drafts(id) on delete set null,
  action_key text not null,
  mutation_scope text not null default 'builder'
    check (mutation_scope in ('builder', 'preview', 'ai_draft', 'responsive', 'visual_style', 'launch')),
  action_status text not null default 'recorded'
    check (action_status in ('recorded', 'allowed', 'throttled', 'blocked', 'failed')),
  validation_result jsonb not null default '{}'::jsonb,
  throttle_state jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.security_events (
  id uuid primary key default gen_random_uuid(),
  store_instance_id uuid references public.store_instances(id) on delete cascade,
  owner_user_id uuid references auth.users(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null default 'security_snapshot'
    check (event_type in ('security_snapshot', 'tenant_validation', 'rate_limit', 'ai_usage_limit', 'builder_mutation', 'abuse_detected', 'invalid_mutation', 'unauthorized_access', 'hostname_spoofing', 'preview_abuse')),
  event_status text not null default 'recorded'
    check (event_status in ('recorded', 'allowed', 'warning', 'blocked', 'error')),
  severity text not null default 'info'
    check (severity in ('info', 'low', 'medium', 'high', 'critical')),
  event_payload jsonb not null default '{}'::jsonb,
  mitigation_state jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.abuse_detection_states (
  id uuid primary key default gen_random_uuid(),
  store_instance_id uuid references public.store_instances(id) on delete cascade,
  owner_user_id uuid references auth.users(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_key text not null default '',
  detection_scope text not null default 'storefront'
    check (detection_scope in ('storefront', 'builder', 'ai', 'preview', 'dashboard', 'api')),
  abuse_status text not null default 'clear'
    check (abuse_status in ('clear', 'watching', 'throttled', 'blocked', 'escalated')),
  risk_score integer not null default 0 check (risk_score >= 0 and risk_score <= 100),
  signal_counts jsonb not null default '{}'::jsonb,
  detection_reasons jsonb not null default '[]'::jsonb,
  mitigation_state jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists request_rate_limits_store_idx
  on public.request_rate_limits(store_instance_id, action_key, limit_status, updated_at desc);

create index if not exists ai_usage_limits_store_idx
  on public.ai_usage_limits(store_instance_id, usage_scope, usage_status, updated_at desc);

create index if not exists builder_action_logs_store_idx
  on public.builder_action_logs(store_instance_id, action_key, created_at desc);

create index if not exists security_events_store_idx
  on public.security_events(store_instance_id, event_type, severity, created_at desc);

create index if not exists abuse_detection_states_store_idx
  on public.abuse_detection_states(store_instance_id, detection_scope, abuse_status, updated_at desc);

alter table public.request_rate_limits enable row level security;
alter table public.ai_usage_limits enable row level security;
alter table public.builder_action_logs enable row level security;
alter table public.security_events enable row level security;
alter table public.abuse_detection_states enable row level security;

do $$
declare
  managed_table text;
begin
  foreach managed_table in array array[
    'request_rate_limits',
    'ai_usage_limits',
    'builder_action_logs',
    'security_events',
    'abuse_detection_states'
  ]
  loop
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = managed_table
        and policyname = 'Buyer store members read security foundation records'
    ) then
      execute format(
        'create policy "Buyer store members read security foundation records" on public.%I for select using (store_instance_id is null or public.can_access_store_instance(store_instance_id))',
        managed_table
      );
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = managed_table
        and policyname = 'Buyer store managers write security foundation records'
    ) then
      execute format(
        'create policy "Buyer store managers write security foundation records" on public.%I for all using (store_instance_id is null or public.can_manage_store_instance(store_instance_id)) with check (store_instance_id is null or public.can_manage_store_instance(store_instance_id))',
        managed_table
      );
    end if;
  end loop;
end $$;

