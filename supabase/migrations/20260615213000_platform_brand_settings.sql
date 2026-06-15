-- Platform brand settings draft storage.
-- Additive only: does not modify store owner theme customize, storefront runtime,
-- store themes, template engine, customer store branding, public theme output,
-- billing, payments, AI control, domains, hosting, or existing customer stores.

create extension if not exists "pgcrypto";

create table if not exists public.platform_brand_settings (
  id uuid primary key default gen_random_uuid(),
  setting_key text unique not null,
  setting_type text not null,
  draft_value jsonb not null default '{}'::jsonb,
  published_value jsonb not null default '{}'::jsonb,
  status text not null default 'draft',
  validation_status text not null default 'placeholder',
  description text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_brand_settings_type_check
    check (setting_type in ('logo', 'favicon', 'color', 'typography', 'mode', 'language', 'layout', 'custom')),
  constraint platform_brand_settings_status_check
    check (status in ('draft', 'published', 'archived')),
  constraint platform_brand_settings_validation_status_check
    check (validation_status in ('ready', 'placeholder', 'invalid', 'needs_attention'))
);

create index if not exists platform_brand_settings_status_idx
on public.platform_brand_settings(status, validation_status);

alter table public.platform_brand_settings enable row level security;

drop policy if exists "service role can manage platform brand settings" on public.platform_brand_settings;
create policy "service role can manage platform brand settings"
on public.platform_brand_settings
for all
to service_role
using (true)
with check (true);

create or replace function public.platform_brand_settings_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists platform_brand_settings_updated_at on public.platform_brand_settings;
create trigger platform_brand_settings_updated_at
before update on public.platform_brand_settings
for each row execute function public.platform_brand_settings_set_updated_at();

insert into public.platform_brand_settings (
  setting_key,
  setting_type,
  draft_value,
  published_value,
  status,
  validation_status,
  description
) values
  (
    'platform_logo',
    'logo',
    '{"path":"/brand/platform-logo.svg"}'::jsonb,
    '{}'::jsonb,
    'draft',
    'placeholder',
    'Draft platform logo path. Upload handling is reserved for a later phase.'
  ),
  (
    'favicon',
    'favicon',
    '{"path":"/favicon.ico"}'::jsonb,
    '{}'::jsonb,
    'draft',
    'placeholder',
    'Draft platform favicon path. Upload handling is reserved for a later phase.'
  ),
  (
    'primary_color',
    'color',
    '{"hex":"#0f172a"}'::jsonb,
    '{}'::jsonb,
    'draft',
    'ready',
    'Draft primary platform brand color.'
  ),
  (
    'secondary_color',
    'color',
    '{"hex":"#2563eb"}'::jsonb,
    '{}'::jsonb,
    'draft',
    'ready',
    'Draft secondary platform brand color.'
  ),
  (
    'accent_color',
    'color',
    '{"hex":"#f97316"}'::jsonb,
    '{}'::jsonb,
    'draft',
    'ready',
    'Draft accent platform brand color.'
  ),
  (
    'typography',
    'typography',
    '{"stack":"Inter / system sans"}'::jsonb,
    '{}'::jsonb,
    'draft',
    'ready',
    'Draft platform typography stack.'
  ),
  (
    'dark_mode',
    'mode',
    '{"mode":"placeholder"}'::jsonb,
    '{}'::jsonb,
    'draft',
    'placeholder',
    'Dark mode remains a draft placeholder and does not change live UI.'
  ),
  (
    'light_mode',
    'mode',
    '{"mode":"placeholder"}'::jsonb,
    '{}'::jsonb,
    'draft',
    'placeholder',
    'Light mode remains a draft placeholder and does not change live UI.'
  )
on conflict (setting_key) do nothing;
