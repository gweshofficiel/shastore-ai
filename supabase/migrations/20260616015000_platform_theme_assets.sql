-- Platform theme asset storage registry.
-- Additive only: does not modify store owner theme customize, storefront runtime,
-- store themes, template engine, customer store branding, public theme output,
-- billing, payments, AI control, domains, hosting, or existing customer stores.

create extension if not exists "pgcrypto";

create table if not exists public.platform_theme_assets (
  id uuid primary key default gen_random_uuid(),
  asset_type text not null,
  storage_provider text not null default 'supabase-storage',
  storage_key text not null,
  public_url text null,
  mime_type text not null,
  file_size bigint not null default 0,
  original_filename text not null,
  status text not null default 'draft',
  uploaded_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_theme_assets_asset_type_check
    check (asset_type in ('logo', 'favicon', 'og_image', 'brand_image', 'custom')),
  constraint platform_theme_assets_status_check
    check (status in ('draft', 'published', 'archived', 'deleted')),
  constraint platform_theme_assets_storage_key_check
    check (storage_key <> ''),
  constraint platform_theme_assets_file_size_check
    check (file_size >= 0)
);

create index if not exists platform_theme_assets_type_status_idx
on public.platform_theme_assets(asset_type, status, created_at desc);

create index if not exists platform_theme_assets_storage_key_idx
on public.platform_theme_assets(storage_key);

alter table public.platform_theme_assets enable row level security;

drop policy if exists "service role can manage platform theme assets" on public.platform_theme_assets;
create policy "service role can manage platform theme assets"
on public.platform_theme_assets
for all
to service_role
using (true)
with check (true);

create or replace function public.platform_theme_assets_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists platform_theme_assets_updated_at on public.platform_theme_assets;
create trigger platform_theme_assets_updated_at
before update on public.platform_theme_assets
for each row execute function public.platform_theme_assets_set_updated_at();
