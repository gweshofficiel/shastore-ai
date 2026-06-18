-- MP-17: Marketplace asset runtime foundation.
-- Additive asset registration only. No purchases, installs, payouts, or public catalog runtime.

create table if not exists public.marketplace_assets (
  id uuid primary key default gen_random_uuid(),
  marketplace_item_id uuid not null references public.marketplace_items(id) on delete restrict,
  asset_type text not null,
  asset_url text null,
  storage_key text not null,
  storage_provider text not null default 'supabase-storage',
  file_name text not null,
  mime_type text not null,
  file_size integer not null default 0,
  sort_order integer not null default 0,
  asset_status text not null default 'draft',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketplace_assets_asset_type_check
    check (asset_type in ('thumbnail', 'gallery_image', 'preview_file', 'documentation', 'demo_media')),
  constraint marketplace_assets_asset_status_check
    check (asset_status in ('draft', 'active', 'hidden', 'archived')),
  constraint marketplace_assets_storage_key_check
    check (storage_key <> ''),
  constraint marketplace_assets_file_name_check
    check (char_length(file_name) > 0),
  constraint marketplace_assets_mime_type_check
    check (char_length(mime_type) > 0),
  constraint marketplace_assets_file_size_check
    check (file_size >= 0),
  constraint marketplace_assets_sort_order_check
    check (sort_order >= 0),
  constraint marketplace_assets_storage_provider_check
    check (storage_provider in ('supabase-storage', 'cloudflare-r2', 'external-url'))
);

create index if not exists marketplace_assets_item_status_idx
  on public.marketplace_assets(marketplace_item_id, asset_status, sort_order asc);

create index if not exists marketplace_assets_type_status_idx
  on public.marketplace_assets(asset_type, asset_status, created_at desc);

alter table public.marketplace_assets enable row level security;

drop policy if exists "service role can manage marketplace assets" on public.marketplace_assets;
create policy "service role can manage marketplace assets"
on public.marketplace_assets
for all
to service_role
using (true)
with check (true);

create or replace function public.marketplace_assets_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists marketplace_assets_updated_at on public.marketplace_assets;
create trigger marketplace_assets_updated_at
before update on public.marketplace_assets
for each row
execute function public.marketplace_assets_set_updated_at();

create or replace function public.marketplace_assets_guard_metadata()
returns trigger
language plpgsql
as $$
declare
  metadata_text text;
begin
  if new.asset_type not in ('thumbnail', 'gallery_image', 'preview_file', 'documentation', 'demo_media') then
    raise exception 'Invalid marketplace asset_type: %', new.asset_type;
  end if;

  if new.asset_status not in ('draft', 'active', 'hidden', 'archived') then
    raise exception 'Invalid marketplace asset_status: %', new.asset_status;
  end if;

  if new.storage_provider not in ('supabase-storage', 'cloudflare-r2', 'external-url') then
    raise exception 'Invalid marketplace storage_provider: %', new.storage_provider;
  end if;

  metadata_text := lower(new.metadata::text);

  if metadata_text like '%api_key%' or metadata_text like '%apikey%' then
    raise exception 'Marketplace asset metadata must not contain API secrets';
  end if;

  if metadata_text like '%password%' or metadata_text like '%secret%' or metadata_text like '%token%' then
    raise exception 'Marketplace asset metadata must not contain secrets';
  end if;

  if metadata_text like '%payout%' or metadata_text like '%bank_account%' or metadata_text like '%iban%' then
    raise exception 'Marketplace asset metadata must not contain payout credentials';
  end if;

  return new;
end;
$$;

drop trigger if exists marketplace_assets_guard_metadata on public.marketplace_assets;
create trigger marketplace_assets_guard_metadata
before insert or update of metadata, asset_type, asset_status, storage_provider
on public.marketplace_assets
for each row
execute function public.marketplace_assets_guard_metadata();
