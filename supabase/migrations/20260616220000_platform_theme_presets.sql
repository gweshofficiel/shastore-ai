-- Platform theme preset manager registry.
-- Additive only: does not modify store owner theme customize, storefront runtime,
-- store themes, template engine, customer store branding, public theme output,
-- platform public website content, billing, payments, AI control, domains, hosting,
-- or existing customer stores.

create extension if not exists "pgcrypto";

create table if not exists public.platform_theme_presets (
  id uuid primary key default gen_random_uuid(),
  preset_key text not null,
  name text not null,
  description text null,
  preset_data jsonb not null default '{}'::jsonb,
  status text not null default 'active',
  is_system boolean not null default false,
  created_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_theme_presets_preset_key_check
    check (preset_key <> ''),
  constraint platform_theme_presets_name_check
    check (name <> ''),
  constraint platform_theme_presets_status_check
    check (status in ('active', 'archived'))
);

create unique index if not exists platform_theme_presets_preset_key_idx
on public.platform_theme_presets(preset_key);

create index if not exists platform_theme_presets_status_created_idx
on public.platform_theme_presets(status, created_at desc);

alter table public.platform_theme_presets enable row level security;

drop policy if exists "service role can manage platform theme presets" on public.platform_theme_presets;
create policy "service role can manage platform theme presets"
on public.platform_theme_presets
for all
to service_role
using (true)
with check (true);

create or replace function public.platform_theme_presets_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists platform_theme_presets_updated_at on public.platform_theme_presets;
create trigger platform_theme_presets_updated_at
before update on public.platform_theme_presets
for each row execute function public.platform_theme_presets_set_updated_at();

insert into public.platform_theme_presets (preset_key, name, description, preset_data, status, is_system)
select *
from (
  values
    (
      'default',
      'Default',
      'Baseline SHASTORE platform branding colors and typography.',
      jsonb_build_object(
        'settings', jsonb_build_object(
          'primary_color', jsonb_build_object('hex', '#0f172a'),
          'secondary_color', jsonb_build_object('hex', '#2563eb'),
          'accent_color', jsonb_build_object('hex', '#f97316'),
          'typography', jsonb_build_object('stack', 'Inter, system-ui, sans-serif'),
          'platform_logo', jsonb_build_object('path', '/brand/platform-logo.svg'),
          'favicon', jsonb_build_object('path', '/favicon.ico'),
          'dark_mode', jsonb_build_object('mode', 'placeholder'),
          'light_mode', jsonb_build_object('mode', 'placeholder')
        )
      ),
      'active',
      true
    ),
    (
      'modern',
      'Modern',
      'Clean blue-forward platform palette with modern typography.',
      jsonb_build_object(
        'settings', jsonb_build_object(
          'primary_color', jsonb_build_object('hex', '#111827'),
          'secondary_color', jsonb_build_object('hex', '#3b82f6'),
          'accent_color', jsonb_build_object('hex', '#06b6d4'),
          'typography', jsonb_build_object('stack', 'Inter, system-ui, sans-serif'),
          'platform_logo', jsonb_build_object('path', '/brand/platform-logo.svg'),
          'favicon', jsonb_build_object('path', '/favicon.ico'),
          'dark_mode', jsonb_build_object('mode', 'placeholder'),
          'light_mode', jsonb_build_object('mode', 'placeholder')
        )
      ),
      'active',
      true
    ),
    (
      'minimal',
      'Minimal',
      'Neutral grayscale palette for a restrained platform look.',
      jsonb_build_object(
        'settings', jsonb_build_object(
          'primary_color', jsonb_build_object('hex', '#18181b'),
          'secondary_color', jsonb_build_object('hex', '#71717a'),
          'accent_color', jsonb_build_object('hex', '#52525b'),
          'typography', jsonb_build_object('stack', 'system-ui, sans-serif'),
          'platform_logo', jsonb_build_object('path', '/brand/platform-logo.svg'),
          'favicon', jsonb_build_object('path', '/favicon.ico'),
          'dark_mode', jsonb_build_object('mode', 'placeholder'),
          'light_mode', jsonb_build_object('mode', 'placeholder')
        )
      ),
      'active',
      true
    ),
    (
      'bold',
      'Bold',
      'High-contrast warm palette for stronger platform CTAs.',
      jsonb_build_object(
        'settings', jsonb_build_object(
          'primary_color', jsonb_build_object('hex', '#7c2d12'),
          'secondary_color', jsonb_build_object('hex', '#ea580c'),
          'accent_color', jsonb_build_object('hex', '#fbbf24'),
          'typography', jsonb_build_object('stack', 'Poppins, Inter, sans-serif'),
          'platform_logo', jsonb_build_object('path', '/brand/platform-logo.svg'),
          'favicon', jsonb_build_object('path', '/favicon.ico'),
          'dark_mode', jsonb_build_object('mode', 'placeholder'),
          'light_mode', jsonb_build_object('mode', 'placeholder')
        )
      ),
      'active',
      true
    ),
    (
      'dark_ready',
      'Dark Ready',
      'Palette prepared for dark-mode placeholders without publishing changes.',
      jsonb_build_object(
        'settings', jsonb_build_object(
          'primary_color', jsonb_build_object('hex', '#0f172a'),
          'secondary_color', jsonb_build_object('hex', '#1e293b'),
          'accent_color', jsonb_build_object('hex', '#38bdf8'),
          'typography', jsonb_build_object('stack', 'Inter, system-ui, sans-serif'),
          'platform_logo', jsonb_build_object('path', '/brand/platform-logo.svg'),
          'favicon', jsonb_build_object('path', '/favicon.ico'),
          'dark_mode', jsonb_build_object('mode', 'dark'),
          'light_mode', jsonb_build_object('mode', 'light')
        )
      ),
      'active',
      true
    )
) as seed(preset_key, name, description, preset_data, status, is_system)
where not exists (
  select 1
  from public.platform_theme_presets existing
  where existing.preset_key = seed.preset_key
);
