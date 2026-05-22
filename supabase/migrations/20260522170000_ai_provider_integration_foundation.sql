-- AI provider integration foundation.
-- Additive only: prepares provider metadata, prompt orchestration, and generation
-- result storage without API keys, real provider calls, storefront rendering changes,
-- checkout, payments, products, reseller, provisioning, domains, or tenant routing changes.

create extension if not exists "pgcrypto";

create table if not exists public.ai_providers (
  id uuid primary key default gen_random_uuid(),
  store_instance_id uuid references public.store_instances(id) on delete cascade,
  owner_user_id uuid references auth.users(id) on delete cascade,
  provider_key text not null default 'openai',
  provider_name text not null default 'OpenAI',
  provider_status text not null default 'disabled'
    check (provider_status in ('disabled', 'configured', 'testing', 'active', 'failed')),
  provider_type text not null default 'text_generation'
    check (provider_type in ('text_generation', 'image_generation', 'multimodal', 'moderation')),
  capabilities jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_instance_id, provider_key)
);

create table if not exists public.ai_provider_configs (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid references public.ai_providers(id) on delete cascade,
  store_instance_id uuid references public.store_instances(id) on delete cascade,
  owner_user_id uuid references auth.users(id) on delete cascade,
  model_key text not null default 'gpt-4o-mini',
  model_label text not null default 'GPT-4o mini',
  config_status text not null default 'placeholder'
    check (config_status in ('placeholder', 'configured', 'active', 'disabled')),
  response_format text not null default 'json_schema'
    check (response_format in ('json', 'json_schema', 'text')),
  temperature numeric not null default 0.4,
  max_output_tokens integer not null default 4000,
  retry_policy jsonb not null default '{"maxAttempts":3,"backoffSeconds":30}'::jsonb,
  token_budget jsonb not null default '{"input":0,"output":0,"total":0}'::jsonb,
  cost_tracking jsonb not null default '{}'::jsonb,
  moderation_policy jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_prompt_templates (
  id uuid primary key default gen_random_uuid(),
  store_instance_id uuid references public.store_instances(id) on delete cascade,
  owner_user_id uuid references auth.users(id) on delete cascade,
  prompt_key text not null,
  prompt_name text not null,
  prompt_type text not null default 'store_generation'
    check (prompt_type in ('store_generation', 'template_customization', 'copywriting', 'seo', 'translation', 'moderation')),
  template_body text not null default '',
  output_schema jsonb not null default '{}'::jsonb,
  variables jsonb not null default '[]'::jsonb,
  version_number integer not null default 1,
  status text not null default 'draft'
    check (status in ('draft', 'active', 'archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_instance_id, prompt_key, version_number)
);

create table if not exists public.ai_generation_results (
  id uuid primary key default gen_random_uuid(),
  store_instance_id uuid not null references public.store_instances(id) on delete cascade,
  owner_user_id uuid references auth.users(id) on delete cascade,
  provider_id uuid references public.ai_providers(id) on delete set null,
  provider_config_id uuid references public.ai_provider_configs(id) on delete set null,
  prompt_template_id uuid references public.ai_prompt_templates(id) on delete set null,
  generation_id uuid references public.ai_store_generations(id) on delete set null,
  queue_id uuid references public.ai_generation_queue(id) on delete set null,
  result_status text not null default 'prepared'
    check (result_status in ('prepared', 'succeeded', 'failed', 'moderated', 'archived')),
  request_payload jsonb not null default '{}'::jsonb,
  raw_response jsonb not null default '{}'::jsonb,
  normalized_response jsonb not null default '{}'::jsonb,
  mapped_builder_schema jsonb not null default '{}'::jsonb,
  token_usage jsonb not null default '{"input":0,"output":0,"total":0}'::jsonb,
  retry_state jsonb not null default '{"attempts":0,"maxAttempts":3}'::jsonb,
  moderation_result jsonb not null default '{}'::jsonb,
  cost_estimate jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_providers_store_idx
  on public.ai_providers(store_instance_id, provider_key, updated_at desc);

create index if not exists ai_provider_configs_store_idx
  on public.ai_provider_configs(store_instance_id, model_key, updated_at desc);

create index if not exists ai_prompt_templates_store_idx
  on public.ai_prompt_templates(store_instance_id, prompt_type, status, updated_at desc);

create index if not exists ai_generation_results_store_idx
  on public.ai_generation_results(store_instance_id, result_status, created_at desc);

alter table public.ai_providers enable row level security;
alter table public.ai_provider_configs enable row level security;
alter table public.ai_prompt_templates enable row level security;
alter table public.ai_generation_results enable row level security;

do $$
declare
  managed_table text;
begin
  foreach managed_table in array array[
    'ai_providers',
    'ai_provider_configs',
    'ai_prompt_templates',
    'ai_generation_results'
  ]
  loop
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = managed_table
        and policyname = 'Buyer store members read AI provider records'
    ) then
      execute format(
        'create policy "Buyer store members read AI provider records" on public.%I for select using (store_instance_id is null or public.can_access_store_instance(store_instance_id))',
        managed_table
      );
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = managed_table
        and policyname = 'Buyer store managers write AI provider records'
    ) then
      execute format(
        'create policy "Buyer store managers write AI provider records" on public.%I for all using (store_instance_id is not null and public.can_manage_store_instance(store_instance_id)) with check (store_instance_id is not null and public.can_manage_store_instance(store_instance_id))',
        managed_table
      );
    end if;
  end loop;
end $$;
