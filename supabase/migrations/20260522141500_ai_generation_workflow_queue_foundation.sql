-- AI generation workflow and queue foundation.
-- Additive only: prepares queue, step, and log persistence without workers, provider calls, credits, payments, or storefront changes.

create extension if not exists "pgcrypto";

create table if not exists public.ai_generation_queue (
  id uuid primary key default gen_random_uuid(),
  generation_id uuid references public.ai_store_generations(id) on delete cascade,
  job_id uuid references public.ai_generation_jobs(id) on delete set null,
  store_instance_id uuid references public.store_instances(id) on delete cascade,
  owner_user_id uuid references auth.users(id) on delete cascade,
  workflow_state text not null default 'queued'
    check (workflow_state in (
      'queued',
      'validating',
      'planning',
      'generating_schema',
      'mapping_to_builder',
      'saving_draft',
      'completed',
      'failed',
      'cancelled'
    )),
  queue_status text not null default 'waiting'
    check (queue_status in ('waiting', 'active', 'blocked', 'completed', 'failed', 'cancelled')),
  priority integer not null default 100,
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  scheduled_for timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  completed_at timestamptz,
  failed_at timestamptz,
  cancelled_at timestamptz,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_generation_steps (
  id uuid primary key default gen_random_uuid(),
  queue_id uuid references public.ai_generation_queue(id) on delete cascade,
  generation_id uuid references public.ai_store_generations(id) on delete cascade,
  store_instance_id uuid references public.store_instances(id) on delete cascade,
  owner_user_id uuid references auth.users(id) on delete cascade,
  step_order integer not null,
  step_key text not null,
  step_status text not null default 'pending'
    check (step_status in ('pending', 'running', 'completed', 'failed', 'skipped', 'cancelled')),
  started_at timestamptz,
  completed_at timestamptz,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (queue_id, step_key)
);

create table if not exists public.ai_generation_logs (
  id uuid primary key default gen_random_uuid(),
  queue_id uuid references public.ai_generation_queue(id) on delete cascade,
  generation_id uuid references public.ai_store_generations(id) on delete cascade,
  step_id uuid references public.ai_generation_steps(id) on delete set null,
  store_instance_id uuid references public.store_instances(id) on delete cascade,
  owner_user_id uuid references auth.users(id) on delete cascade,
  log_level text not null default 'info'
    check (log_level in ('debug', 'info', 'warning', 'error')),
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_generation_queue_store_status_idx
  on public.ai_generation_queue(store_instance_id, queue_status, created_at desc);

create index if not exists ai_generation_queue_generation_idx
  on public.ai_generation_queue(generation_id, created_at desc);

create index if not exists ai_generation_queue_owner_idx
  on public.ai_generation_queue(owner_user_id, created_at desc);

create index if not exists ai_generation_steps_queue_order_idx
  on public.ai_generation_steps(queue_id, step_order);

create index if not exists ai_generation_steps_store_idx
  on public.ai_generation_steps(store_instance_id, created_at desc);

create index if not exists ai_generation_logs_queue_idx
  on public.ai_generation_logs(queue_id, created_at desc);

create index if not exists ai_generation_logs_store_idx
  on public.ai_generation_logs(store_instance_id, created_at desc);

alter table public.ai_generation_queue enable row level security;
alter table public.ai_generation_steps enable row level security;
alter table public.ai_generation_logs enable row level security;

do $$
declare
  managed_table text;
begin
  foreach managed_table in array array[
    'ai_generation_queue',
    'ai_generation_steps',
    'ai_generation_logs'
  ]
  loop
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = managed_table
        and policyname = 'Buyer store members read ai workflow records'
    ) then
      execute format(
        'create policy "Buyer store members read ai workflow records" on public.%I for select using ((store_instance_id is not null and public.can_access_store_instance(store_instance_id)) or (store_instance_id is null and owner_user_id = auth.uid()))',
        managed_table
      );
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = managed_table
        and policyname = 'Buyer store managers write ai workflow records'
    ) then
      execute format(
        'create policy "Buyer store managers write ai workflow records" on public.%I for all using ((store_instance_id is not null and public.can_manage_store_instance(store_instance_id)) or (store_instance_id is null and owner_user_id = auth.uid())) with check ((store_instance_id is not null and public.can_manage_store_instance(store_instance_id)) or (store_instance_id is null and owner_user_id = auth.uid()))',
        managed_table
      );
    end if;
  end loop;
end $$;

create or replace function public.set_ai_workflow_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'ai_generation_queue_updated_at') then
    create trigger ai_generation_queue_updated_at
      before update on public.ai_generation_queue
      for each row execute function public.set_ai_workflow_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'ai_generation_steps_updated_at') then
    create trigger ai_generation_steps_updated_at
      before update on public.ai_generation_steps
      for each row execute function public.set_ai_workflow_updated_at();
  end if;
end $$;
