-- Platform white-label settings (platform/admin/public shell only).
-- Additive only: does not modify store owner theme customize, storefront runtime,
-- store themes, template engine, customer store branding, customer storefronts,
-- billing, payments, AI control, domains, hosting, or existing customer stores.

create extension if not exists "pgcrypto";

create table if not exists public.platform_white_label_settings (
  id uuid primary key default gen_random_uuid(),
  brand_name text not null default 'SHASTORE AI',
  legal_name text null,
  support_email text null,
  support_url text null,
  documentation_url text null,
  show_powered_by boolean not null default true,
  powered_by_label text null,
  status text not null default 'draft',
  draft_value jsonb not null default '{}'::jsonb,
  published_value jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_white_label_settings_status_check
    check (status in ('draft', 'published', 'archived'))
);

create index if not exists platform_white_label_settings_status_idx
on public.platform_white_label_settings(status);

alter table public.platform_white_label_settings enable row level security;

drop policy if exists "service role can manage platform white label settings" on public.platform_white_label_settings;
create policy "service role can manage platform white label settings"
on public.platform_white_label_settings
for all
to service_role
using (true)
with check (true);

create or replace function public.platform_white_label_settings_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists platform_white_label_settings_updated_at on public.platform_white_label_settings;
create trigger platform_white_label_settings_updated_at
before update on public.platform_white_label_settings
for each row execute function public.platform_white_label_settings_set_updated_at();

insert into public.platform_white_label_settings (
  id,
  brand_name,
  legal_name,
  support_email,
  support_url,
  documentation_url,
  show_powered_by,
  powered_by_label,
  status,
  draft_value,
  published_value
) values (
  '00000000-0000-4000-8000-000000000001',
  'SHASTORE AI',
  null,
  null,
  null,
  null,
  true,
  'Powered by SHASTORE',
  'draft',
  jsonb_build_object(
    'brandName', 'SHASTORE AI',
    'legalName', null,
    'supportEmail', null,
    'supportUrl', null,
    'documentationUrl', null,
    'showPoweredBy', true,
    'poweredByLabel', 'Powered by SHASTORE'
  ),
  '{}'::jsonb
)
on conflict (id) do nothing;
