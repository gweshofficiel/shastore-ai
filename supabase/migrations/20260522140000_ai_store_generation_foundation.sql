-- AI store generation foundation.
-- Additive only: prepares AI request/job persistence without calling AI providers or changing storefront, builder, products, checkout, reseller, provisioning, domains, or tenant routing.

create extension if not exists "pgcrypto";

create table if not exists public.ai_store_generations (
  id uuid primary key default gen_random_uuid(),
  store_instance_id uuid references public.store_instances(id) on delete cascade,
  owner_user_id uuid references auth.users(id) on delete cascade,
  status text not null default 'draft'
    check (status in ('draft', 'queued', 'generating', 'ready', 'failed', 'applied', 'archived')),
  niche text not null default '',
  store_type text not null default 'general',
  language text not null default 'en',
  target_audience text,
  brand_style text not null default 'modern',
  layout_intent text not null default 'conversion',
  request_schema jsonb not null default '{}'::jsonb,
  generated_store_schema jsonb not null default '{}'::jsonb,
  generated_layout_schema jsonb not null default '{"version":1,"sections":[]}'::jsonb,
  generated_sections_schema jsonb not null default '[]'::jsonb,
  generated_branding_schema jsonb not null default '{}'::jsonb,
  section_composition_plan jsonb not null default '[]'::jsonb,
  theme_suggestion_plan jsonb not null default '{}'::jsonb,
  branding_suggestion_plan jsonb not null default '{}'::jsonb,
  prompt_preview text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_generation_jobs (
  id uuid primary key default gen_random_uuid(),
  generation_id uuid references public.ai_store_generations(id) on delete cascade,
  store_instance_id uuid references public.store_instances(id) on delete cascade,
  owner_user_id uuid references auth.users(id) on delete cascade,
  provider text not null default 'manual_placeholder',
  job_type text not null default 'store_generation'
    check (job_type in ('store_generation', 'theme_generation', 'sections_generation', 'copy_generation', 'branding_generation')),
  status text not null default 'queued'
    check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  input_schema jsonb not null default '{}'::jsonb,
  output_schema jsonb not null default '{}'::jsonb,
  error_message text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ai_store_generations
  add column if not exists store_instance_id uuid references public.store_instances(id) on delete cascade,
  add column if not exists owner_user_id uuid references auth.users(id) on delete cascade,
  add column if not exists status text not null default 'draft',
  add column if not exists niche text not null default '',
  add column if not exists store_type text not null default 'general',
  add column if not exists language text not null default 'en',
  add column if not exists target_audience text,
  add column if not exists brand_style text not null default 'modern',
  add column if not exists layout_intent text not null default 'conversion',
  add column if not exists request_schema jsonb not null default '{}'::jsonb,
  add column if not exists generated_store_schema jsonb not null default '{}'::jsonb,
  add column if not exists generated_layout_schema jsonb not null default '{"version":1,"sections":[]}'::jsonb,
  add column if not exists generated_sections_schema jsonb not null default '[]'::jsonb,
  add column if not exists generated_branding_schema jsonb not null default '{}'::jsonb,
  add column if not exists section_composition_plan jsonb not null default '[]'::jsonb,
  add column if not exists theme_suggestion_plan jsonb not null default '{}'::jsonb,
  add column if not exists branding_suggestion_plan jsonb not null default '{}'::jsonb,
  add column if not exists prompt_preview text;

alter table public.ai_generation_jobs
  add column if not exists generation_id uuid references public.ai_store_generations(id) on delete cascade,
  add column if not exists store_instance_id uuid references public.store_instances(id) on delete cascade,
  add column if not exists owner_user_id uuid references auth.users(id) on delete cascade,
  add column if not exists provider text not null default 'manual_placeholder',
  add column if not exists job_type text not null default 'store_generation',
  add column if not exists status text not null default 'queued',
  add column if not exists input_schema jsonb not null default '{}'::jsonb,
  add column if not exists output_schema jsonb not null default '{}'::jsonb,
  add column if not exists error_message text,
  add column if not exists started_at timestamptz,
  add column if not exists finished_at timestamptz;

update public.ai_store_generations generations
set owner_user_id = instances.owner_user_id
from public.store_instances instances
where generations.store_instance_id = instances.id
  and generations.owner_user_id is null;

update public.ai_generation_jobs jobs
set owner_user_id = instances.owner_user_id
from public.store_instances instances
where jobs.store_instance_id = instances.id
  and jobs.owner_user_id is null;

create index if not exists ai_store_generations_store_idx
  on public.ai_store_generations(store_instance_id, created_at desc);

create index if not exists ai_store_generations_owner_idx
  on public.ai_store_generations(owner_user_id, created_at desc);

create index if not exists ai_generation_jobs_generation_idx
  on public.ai_generation_jobs(generation_id, created_at desc);

create index if not exists ai_generation_jobs_store_status_idx
  on public.ai_generation_jobs(store_instance_id, status, created_at desc);

alter table public.ai_store_generations enable row level security;
alter table public.ai_generation_jobs enable row level security;

do $$
declare
  managed_table text;
begin
  foreach managed_table in array array[
    'ai_store_generations',
    'ai_generation_jobs'
  ]
  loop
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = managed_table
        and policyname = 'Buyer store members read ai generation records'
    ) then
      execute format(
        'create policy "Buyer store members read ai generation records" on public.%I for select using ((store_instance_id is not null and public.can_access_store_instance(store_instance_id)) or (store_instance_id is null and owner_user_id = auth.uid()))',
        managed_table
      );
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = managed_table
        and policyname = 'Buyer store managers write ai generation records'
    ) then
      execute format(
        'create policy "Buyer store managers write ai generation records" on public.%I for all using ((store_instance_id is not null and public.can_manage_store_instance(store_instance_id)) or (store_instance_id is null and owner_user_id = auth.uid())) with check ((store_instance_id is not null and public.can_manage_store_instance(store_instance_id)) or (store_instance_id is null and owner_user_id = auth.uid()))',
        managed_table
      );
    end if;
  end loop;
end $$;

create or replace function public.set_ai_store_generations_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.set_ai_generation_jobs_updated_at()
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
  if not exists (select 1 from pg_trigger where tgname = 'ai_store_generations_updated_at') then
    create trigger ai_store_generations_updated_at
      before update on public.ai_store_generations
      for each row execute function public.set_ai_store_generations_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'ai_generation_jobs_updated_at') then
    create trigger ai_generation_jobs_updated_at
      before update on public.ai_generation_jobs
      for each row execute function public.set_ai_generation_jobs_updated_at();
  end if;
end $$;
