-- Template install audit/runtime for Super Admin manual installs only.
-- Additive only: controlled installs into a single selected store.

create table if not exists public.template_installs (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.template_registry(id) on delete cascade,
  template_version_id uuid references public.template_versions(id) on delete set null,
  store_id uuid not null references public.stores(id) on delete cascade,
  status text not null default 'prepared',
  install_mode text not null default 'super_admin_manual',
  started_at timestamptz null,
  completed_at timestamptz null,
  failed_at timestamptz null,
  error_message text null,
  installed_summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint template_installs_status_check
    check (status in ('prepared', 'installing', 'completed', 'failed', 'cancelled')),
  constraint template_installs_install_mode_check
    check (install_mode in ('super_admin_manual'))
);

create index if not exists template_installs_template_status_idx
  on public.template_installs(template_id, status, created_at desc);

create index if not exists template_installs_store_status_idx
  on public.template_installs(store_id, status, created_at desc);

alter table public.template_installs enable row level security;

drop policy if exists "service role can manage template installs" on public.template_installs;
create policy "service role can manage template installs"
on public.template_installs
for all
to service_role
using (true)
with check (true);

create or replace function public.template_installs_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists template_installs_updated_at on public.template_installs;
create trigger template_installs_updated_at
before update on public.template_installs
for each row execute function public.template_installs_set_updated_at();
