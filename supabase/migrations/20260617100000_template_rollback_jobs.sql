-- Template rollback jobs for Super Admin manual rollbacks only.
-- Additive metadata/runtime tracking; no bulk or automatic rollbacks.

create table if not exists public.template_rollback_jobs (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  template_id uuid not null references public.template_registry(id) on delete cascade,
  from_version_id uuid references public.template_versions(id) on delete set null,
  to_version_id uuid not null references public.template_versions(id) on delete restrict,
  assignment_id uuid references public.store_template_assignments(id) on delete set null,
  update_job_id uuid references public.template_update_jobs(id) on delete set null,
  status text not null default 'prepared',
  rollback_mode text not null default 'super_admin_manual',
  started_at timestamptz null,
  completed_at timestamptz null,
  failed_at timestamptz null,
  error_message text null,
  rollback_summary jsonb not null default '{}'::jsonb,
  conflicts jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint template_rollback_jobs_status_check
    check (status in ('prepared', 'rolling_back', 'completed', 'failed', 'cancelled')),
  constraint template_rollback_jobs_rollback_mode_check
    check (rollback_mode in ('super_admin_manual'))
);

create index if not exists template_rollback_jobs_store_status_idx
  on public.template_rollback_jobs(store_id, status, created_at desc);

create index if not exists template_rollback_jobs_template_status_idx
  on public.template_rollback_jobs(template_id, status, created_at desc);

create index if not exists template_rollback_jobs_update_job_idx
  on public.template_rollback_jobs(update_job_id)
  where update_job_id is not null;

alter table public.template_rollback_jobs enable row level security;

drop policy if exists "service role can manage template rollback jobs" on public.template_rollback_jobs;
create policy "service role can manage template rollback jobs"
on public.template_rollback_jobs
for all
to service_role
using (true)
with check (true);

create or replace function public.template_rollback_jobs_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists template_rollback_jobs_updated_at on public.template_rollback_jobs;
create trigger template_rollback_jobs_updated_at
before update on public.template_rollback_jobs
for each row execute function public.template_rollback_jobs_set_updated_at();
