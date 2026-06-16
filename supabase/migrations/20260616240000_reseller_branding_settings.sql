-- Reseller branding settings (platform theme inheritance only).
-- Additive only: does not modify store owner theme customize, storefront runtime,
-- store themes, template engine, customer store branding, customer storefronts,
-- platform white-label settings, billing, payments, AI control, domains, hosting,
-- or existing customer stores.

create extension if not exists "pgcrypto";

create table if not exists public.reseller_branding_settings (
  id uuid primary key default gen_random_uuid(),
  reseller_id uuid unique not null,
  inheritance_mode text not null default 'inherit_platform',
  draft_value jsonb not null default '{}'::jsonb,
  published_value jsonb not null default '{}'::jsonb,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reseller_branding_settings_inheritance_mode_check
    check (inheritance_mode in ('inherit_platform', 'custom_branding')),
  constraint reseller_branding_settings_status_check
    check (status in ('draft', 'published', 'archived'))
);

create index if not exists reseller_branding_settings_reseller_id_idx
on public.reseller_branding_settings(reseller_id);

create index if not exists reseller_branding_settings_status_idx
on public.reseller_branding_settings(status, inheritance_mode);

alter table public.reseller_branding_settings enable row level security;

drop policy if exists "service role can manage reseller branding settings" on public.reseller_branding_settings;
create policy "service role can manage reseller branding settings"
on public.reseller_branding_settings
for all
to service_role
using (true)
with check (true);

create or replace function public.reseller_branding_settings_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists reseller_branding_settings_updated_at on public.reseller_branding_settings;
create trigger reseller_branding_settings_updated_at
before update on public.reseller_branding_settings
for each row execute function public.reseller_branding_settings_set_updated_at();
