-- Template version runtime for Super Admin Template Management Center.
-- Additive only: tracks template versions in admin registry without installing into stores.

create table if not exists public.template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.template_registry(id) on delete cascade,
  version_number text not null,
  changelog text,
  package_snapshot jsonb not null default '{}'::jsonb,
  status text not null default 'draft',
  created_by text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint template_versions_status_check
    check (status in ('draft', 'published', 'archived')),
  constraint template_versions_template_version_unique
    unique (template_id, version_number)
);

create index if not exists template_versions_template_id_idx
  on public.template_versions(template_id, status);

create index if not exists template_versions_status_idx
  on public.template_versions(status, published_at desc);

alter table public.template_versions enable row level security;

drop policy if exists "service role can manage template versions" on public.template_versions;
create policy "service role can manage template versions"
on public.template_versions
for all
to service_role
using (true)
with check (true);

create or replace function public.template_versions_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists template_versions_updated_at on public.template_versions;
create trigger template_versions_updated_at
before update on public.template_versions
for each row execute function public.template_versions_set_updated_at();

insert into public.template_versions (
  template_id,
  version_number,
  changelog,
  package_snapshot,
  status,
  published_at
)
select
  tr.id,
  coalesce(nullif(trim(tr.version), ''), '1'),
  'Initial registry version seeded from template_registry.',
  coalesce(tr.package_summary, '{}'::jsonb),
  case
    when tr.status = 'active' then 'published'
    when tr.status = 'archived' then 'archived'
    else 'draft'
  end,
  case when tr.status = 'active' then now() else null end
from public.template_registry tr
where not exists (
  select 1
  from public.template_versions tv
  where tv.template_id = tr.id
    and tv.version_number = coalesce(nullif(trim(tr.version), ''), '1')
)
on conflict (template_id, version_number) do nothing;
