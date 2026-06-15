-- Platform theme registry foundation.
-- Additive only: does not modify store owner theme customize, storefront runtime,
-- store themes, template engine, customer store branding, billing, payments,
-- AI control, domains, hosting, or existing customer stores.

create extension if not exists "pgcrypto";

create table if not exists public.platform_theme_registry (
  id uuid primary key default gen_random_uuid(),
  section_key text unique not null,
  section_label text not null,
  section_type text not null,
  value jsonb not null default '{}'::jsonb,
  status text not null default 'placeholder',
  description text null,
  sort_order integer not null default 0,
  is_system boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_theme_registry_section_type_check
    check (section_type in ('logo', 'favicon', 'color', 'typography', 'mode', 'language', 'preview', 'custom')),
  constraint platform_theme_registry_status_check
    check (status in ('ready', 'placeholder', 'needs_attention', 'disabled'))
);

create index if not exists platform_theme_registry_sort_idx
on public.platform_theme_registry(sort_order, section_label);

create index if not exists platform_theme_registry_status_idx
on public.platform_theme_registry(status, section_type);

alter table public.platform_theme_registry enable row level security;

drop policy if exists "service role can manage platform theme registry" on public.platform_theme_registry;
create policy "service role can manage platform theme registry"
on public.platform_theme_registry
for all
to service_role
using (true)
with check (true);

create or replace function public.platform_theme_registry_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists platform_theme_registry_updated_at on public.platform_theme_registry;
create trigger platform_theme_registry_updated_at
before update on public.platform_theme_registry
for each row execute function public.platform_theme_registry_set_updated_at();

insert into public.platform_theme_registry (
  section_key,
  section_label,
  section_type,
  value,
  status,
  description,
  sort_order,
  is_system
) values
  (
    'platform_logo',
    'Platform logo',
    'logo',
    '{"text":"SHASTORE AI"}'::jsonb,
    'ready',
    'Text/logo mark for SHASTORE SaaS interface and public platform website.',
    10,
    true
  ),
  (
    'favicon',
    'Favicon',
    'favicon',
    '{"text":"Platform favicon placeholder"}'::jsonb,
    'placeholder',
    'Favicon placeholder only; upload workflow is not connected yet.',
    20,
    true
  ),
  (
    'primary_color',
    'Primary color',
    'color',
    '{"hex":"#0f172a"}'::jsonb,
    'ready',
    'Primary platform brand color for admin/public chrome.',
    30,
    true
  ),
  (
    'secondary_color',
    'Secondary color',
    'color',
    '{"hex":"#2563eb"}'::jsonb,
    'ready',
    'Secondary platform brand color for links and supporting CTAs.',
    40,
    true
  ),
  (
    'accent_color',
    'Accent color',
    'color',
    '{"hex":"#f97316"}'::jsonb,
    'ready',
    'Accent color reserved for highlights and marketing moments.',
    50,
    true
  ),
  (
    'typography',
    'Typography',
    'typography',
    '{"stack":"Inter / system sans"}'::jsonb,
    'ready',
    'Platform typography stack for SaaS UI and marketing pages.',
    60,
    true
  ),
  (
    'dark_mode',
    'Dark mode placeholder',
    'mode',
    '{"mode":"placeholder"}'::jsonb,
    'placeholder',
    'Dark mode is reserved and does not change live UI yet.',
    70,
    true
  ),
  (
    'light_mode',
    'Light mode placeholder',
    'mode',
    '{"mode":"placeholder"}'::jsonb,
    'placeholder',
    'Light mode is the current platform baseline.',
    80,
    true
  )
on conflict (section_key) do nothing;
