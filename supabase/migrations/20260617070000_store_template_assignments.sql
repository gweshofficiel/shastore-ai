-- Store template assignment tracking for Super Admin runtime only.
-- Metadata-only: does not mutate store content, pages, products, or themes.

create table if not exists public.store_template_assignments (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  template_id uuid not null references public.template_registry(id) on delete cascade,
  template_version_id uuid references public.template_versions(id) on delete set null,
  install_id uuid references public.template_installs(id) on delete set null,
  assignment_status text not null default 'assigned',
  assignment_source text not null default 'super_admin_manual',
  assigned_by uuid references auth.users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  unassigned_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint store_template_assignments_status_check
    check (assignment_status in ('assigned', 'active', 'inactive', 'unassigned', 'failed')),
  constraint store_template_assignments_source_check
    check (assignment_source in ('super_admin_manual', 'template_install', 'store_creation', 'migration'))
);

create index if not exists store_template_assignments_store_status_idx
  on public.store_template_assignments(store_id, assignment_status, assigned_at desc);

create index if not exists store_template_assignments_template_status_idx
  on public.store_template_assignments(template_id, assignment_status, assigned_at desc);

create index if not exists store_template_assignments_install_idx
  on public.store_template_assignments(install_id)
  where install_id is not null;

alter table public.store_template_assignments enable row level security;

drop policy if exists "service role can manage store template assignments" on public.store_template_assignments;
create policy "service role can manage store template assignments"
on public.store_template_assignments
for all
to service_role
using (true)
with check (true);

create or replace function public.store_template_assignments_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists store_template_assignments_updated_at on public.store_template_assignments;
create trigger store_template_assignments_updated_at
before update on public.store_template_assignments
for each row execute function public.store_template_assignments_set_updated_at();
