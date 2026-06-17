-- Template screenshot storage for Super Admin Template Management Center.
-- Additive only: metadata and safe public URLs without storefront or store mutations.

create table if not exists public.template_screenshots (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.template_registry(id) on delete cascade,
  version_id uuid references public.template_versions(id) on delete set null,
  screenshot_type text not null,
  storage_provider text not null default 'supabase-storage',
  storage_key text not null,
  public_url text null,
  original_filename text null,
  mime_type text not null,
  file_size integer not null default 0,
  sort_order integer not null default 0,
  status text not null default 'draft',
  uploaded_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint template_screenshots_type_check
    check (screenshot_type in ('desktop', 'mobile', 'tablet', 'thumbnail', 'hero', 'gallery')),
  constraint template_screenshots_status_check
    check (status in ('draft', 'published', 'archived', 'deleted')),
  constraint template_screenshots_storage_key_check
    check (storage_key <> ''),
  constraint template_screenshots_file_size_check
    check (file_size >= 0)
);

create index if not exists template_screenshots_template_status_idx
  on public.template_screenshots(template_id, status, sort_order);

create index if not exists template_screenshots_type_idx
  on public.template_screenshots(screenshot_type, status);

alter table public.template_screenshots enable row level security;

drop policy if exists "service role can manage template screenshots" on public.template_screenshots;
create policy "service role can manage template screenshots"
on public.template_screenshots
for all
to service_role
using (true)
with check (true);

create or replace function public.template_screenshots_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists template_screenshots_updated_at on public.template_screenshots;
create trigger template_screenshots_updated_at
before update on public.template_screenshots
for each row execute function public.template_screenshots_set_updated_at();
