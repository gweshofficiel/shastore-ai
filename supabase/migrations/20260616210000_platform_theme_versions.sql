-- Platform theme version history registry.
-- Additive only: does not modify store owner theme customize, storefront runtime,
-- store themes, template engine, customer store branding, public theme output,
-- platform public website content, billing, payments, AI control, domains, hosting,
-- or existing customer stores.

create extension if not exists "pgcrypto";

create table if not exists public.platform_theme_versions (
  id uuid primary key default gen_random_uuid(),
  version_number integer not null,
  snapshot_type text not null,
  snapshot jsonb not null default '{}'::jsonb,
  created_by uuid null,
  created_at timestamptz not null default now(),
  note text null,
  constraint platform_theme_versions_snapshot_type_check
    check (snapshot_type in ('draft_saved', 'published', 'asset_uploaded', 'manual_snapshot')),
  constraint platform_theme_versions_version_number_check
    check (version_number > 0)
);

create unique index if not exists platform_theme_versions_version_number_idx
on public.platform_theme_versions(version_number);

create index if not exists platform_theme_versions_type_created_idx
on public.platform_theme_versions(snapshot_type, created_at desc);

alter table public.platform_theme_versions enable row level security;

drop policy if exists "service role can manage platform theme versions" on public.platform_theme_versions;
create policy "service role can manage platform theme versions"
on public.platform_theme_versions
for all
to service_role
using (true)
with check (true);
