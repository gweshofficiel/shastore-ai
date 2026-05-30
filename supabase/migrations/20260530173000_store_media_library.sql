-- Store media library foundation.
-- Additive only: reuses the existing public product-images storage bucket.

create extension if not exists "pgcrypto";

create table if not exists public.store_media (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid,
  store_id uuid references public.stores(id) on delete cascade,
  file_name text not null,
  file_url text not null,
  file_type text not null default 'image',
  mime_type text,
  size_bytes bigint not null default 0,
  storage_key text not null,
  usage_type text not null default 'library',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.store_media
  add column if not exists workspace_id uuid,
  add column if not exists store_instance_id uuid,
  add column if not exists store_id uuid references public.stores(id) on delete cascade,
  add column if not exists file_name text,
  add column if not exists file_path text,
  add column if not exists file_url text,
  add column if not exists file_type text not null default 'image',
  add column if not exists mime_type text,
  add column if not exists size_bytes bigint not null default 0,
  add column if not exists storage_key text,
  add column if not exists usage_type text not null default 'library',
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.store_media
  alter column store_instance_id drop not null;

create unique index if not exists store_media_storage_key_unique_idx
on public.store_media(storage_key);

create index if not exists store_media_workspace_store_created_idx
on public.store_media(workspace_id, store_id, created_at desc);

create table if not exists public.media_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid,
  store_id uuid,
  media_id uuid references public.store_media(id) on delete set null,
  action text not null,
  created_at timestamptz not null default now()
);

create index if not exists media_logs_workspace_store_created_idx
on public.media_logs(workspace_id, store_id, created_at desc);

alter table public.store_media enable row level security;
alter table public.media_logs enable row level security;

drop policy if exists "workspace members read store media" on public.store_media;
create policy "workspace members read store media"
on public.store_media
for select
to authenticated
using (
  workspace_id is not null
  and public.can_access_workspace(workspace_id)
);

drop policy if exists "workspace editors manage store media" on public.store_media;
create policy "workspace editors manage store media"
on public.store_media
for all
to authenticated
using (
  workspace_id is not null
  and public.workspace_can_edit(workspace_id)
)
with check (
  workspace_id is not null
  and public.workspace_can_edit(workspace_id)
);

drop policy if exists "workspace members read media logs" on public.media_logs;
create policy "workspace members read media logs"
on public.media_logs
for select
to authenticated
using (
  workspace_id is not null
  and public.can_access_workspace(workspace_id)
);

drop policy if exists "service role can manage media logs" on public.media_logs;
create policy "service role can manage media logs"
on public.media_logs
for all
to service_role
using (true)
with check (true);
