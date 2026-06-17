-- Unified template asset storage for Super Admin Template Management Center.
-- Additive only: template-related files without storefront or store mutations.

create table if not exists public.template_assets (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.template_registry(id) on delete cascade,
  version_id uuid references public.template_versions(id) on delete set null,
  asset_type text not null,
  storage_provider text not null default 'supabase-storage',
  storage_key text not null,
  public_url text null,
  original_filename text null,
  mime_type text not null,
  file_size integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'draft',
  uploaded_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint template_assets_asset_type_check
    check (asset_type in ('screenshot', 'preview_image', 'icon', 'demo_media', 'package_file', 'documentation', 'custom')),
  constraint template_assets_status_check
    check (status in ('draft', 'published', 'archived', 'deleted')),
  constraint template_assets_storage_key_check
    check (storage_key <> ''),
  constraint template_assets_file_size_check
    check (file_size >= 0)
);

create index if not exists template_assets_template_status_idx
  on public.template_assets(template_id, status, created_at desc);

create index if not exists template_assets_type_idx
  on public.template_assets(asset_type, status);

alter table public.template_assets enable row level security;

drop policy if exists "service role can manage template assets" on public.template_assets;
create policy "service role can manage template assets"
on public.template_assets
for all
to service_role
using (true)
with check (true);

create or replace function public.template_assets_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists template_assets_updated_at on public.template_assets;
create trigger template_assets_updated_at
before update on public.template_assets
for each row execute function public.template_assets_set_updated_at();
