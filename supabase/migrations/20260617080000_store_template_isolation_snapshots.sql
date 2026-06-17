-- Store template theme isolation snapshots for Super Admin runtime only.
-- Additive metadata tracking; no store content or theme mutations.

create table if not exists public.store_template_isolation_snapshots (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  template_id uuid references public.template_registry(id) on delete set null,
  template_version_id uuid references public.template_versions(id) on delete set null,
  install_id uuid references public.template_installs(id) on delete set null,
  snapshot jsonb not null default '{}'::jsonb,
  isolation_status text not null default 'safe',
  issues jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint store_template_isolation_snapshots_status_check
    check (isolation_status in ('safe', 'warning', 'failed'))
);

create index if not exists store_template_isolation_snapshots_store_created_idx
  on public.store_template_isolation_snapshots(store_id, created_at desc);

create index if not exists store_template_isolation_snapshots_status_created_idx
  on public.store_template_isolation_snapshots(isolation_status, created_at desc);

create index if not exists store_template_isolation_snapshots_template_idx
  on public.store_template_isolation_snapshots(template_id, created_at desc)
  where template_id is not null;

alter table public.store_template_isolation_snapshots enable row level security;

drop policy if exists "service role can manage store template isolation snapshots" on public.store_template_isolation_snapshots;
create policy "service role can manage store template isolation snapshots"
on public.store_template_isolation_snapshots
for all
to service_role
using (true)
with check (true);
