-- Reseller template access for Super Admin controlled reseller catalog assignments.
-- Additive only: no automatic install, store mutation, or payment flows.

create table if not exists public.reseller_template_access (
  id uuid primary key default gen_random_uuid(),
  reseller_id uuid not null references public.reseller_profiles(id) on delete cascade,
  template_id uuid not null references public.template_registry(id) on delete cascade,
  template_version_id uuid references public.template_versions(id) on delete set null,
  access_status text not null default 'active',
  access_type text not null default 'assigned',
  assigned_by text null,
  assigned_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reseller_template_access_status_check
    check (access_status in ('active', 'suspended', 'revoked')),
  constraint reseller_template_access_type_check
    check (access_type in ('assigned', 'inherited', 'marketplace'))
);

create index if not exists reseller_template_access_reseller_status_idx
  on public.reseller_template_access(reseller_id, access_status, assigned_at desc);

create index if not exists reseller_template_access_template_status_idx
  on public.reseller_template_access(template_id, access_status, assigned_at desc);

create unique index if not exists reseller_template_access_active_assignment_idx
  on public.reseller_template_access(reseller_id, template_id)
  where access_status in ('active', 'suspended');

alter table public.reseller_template_access enable row level security;

drop policy if exists "service role can manage reseller template access" on public.reseller_template_access;
create policy "service role can manage reseller template access"
on public.reseller_template_access
for all
to service_role
using (true)
with check (true);

create or replace function public.reseller_template_access_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists reseller_template_access_updated_at on public.reseller_template_access;
create trigger reseller_template_access_updated_at
before update on public.reseller_template_access
for each row execute function public.reseller_template_access_set_updated_at();
