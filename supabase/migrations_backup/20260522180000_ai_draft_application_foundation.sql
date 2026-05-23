-- AI draft application UX foundation.
-- Additive only: reviews and applies safe AI suggestions to builder drafts without
-- direct publishing, destructive schema overwrites, section deletion, tenant bypass,
-- storefront rendering changes, checkout/payments, products, reseller, provisioning,
-- domains, or tenant routing changes.

create extension if not exists "pgcrypto";

create table if not exists public.ai_draft_applications (
  id uuid primary key default gen_random_uuid(),
  store_instance_id uuid not null references public.store_instances(id) on delete cascade,
  owner_user_id uuid references auth.users(id) on delete cascade,
  customization_id uuid references public.ai_template_customizations(id) on delete set null,
  execution_log_id uuid references public.ai_execution_logs(id) on delete set null,
  builder_page_id uuid references public.builder_pages(id) on delete cascade,
  builder_draft_id uuid references public.builder_drafts(id) on delete set null,
  application_status text not null default 'preview'
    check (application_status in ('preview', 'partially_applied', 'applied', 'rejected', 'rolled_back', 'failed', 'archived')),
  application_scope text not null default 'safe_copy_branding'
    check (application_scope in ('safe_copy_branding', 'copy_only', 'branding_only', 'layout_recommendations', 'partial')),
  applied_fields jsonb not null default '[]'::jsonb,
  rejected_fields jsonb not null default '[]'::jsonb,
  before_snapshot jsonb not null default '{}'::jsonb,
  after_snapshot jsonb not null default '{}'::jsonb,
  rollback_snapshot jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_suggestion_reviews (
  id uuid primary key default gen_random_uuid(),
  store_instance_id uuid not null references public.store_instances(id) on delete cascade,
  owner_user_id uuid references auth.users(id) on delete cascade,
  customization_id uuid references public.ai_template_customizations(id) on delete set null,
  draft_application_id uuid references public.ai_draft_applications(id) on delete cascade,
  review_status text not null default 'pending'
    check (review_status in ('pending', 'accepted', 'partially_accepted', 'rejected', 'archived')),
  review_notes text not null default '',
  reviewed_fields jsonb not null default '[]'::jsonb,
  rejected_fields jsonb not null default '[]'::jsonb,
  partial_apply_config jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_change_previews (
  id uuid primary key default gen_random_uuid(),
  store_instance_id uuid not null references public.store_instances(id) on delete cascade,
  owner_user_id uuid references auth.users(id) on delete cascade,
  customization_id uuid references public.ai_template_customizations(id) on delete set null,
  draft_application_id uuid references public.ai_draft_applications(id) on delete cascade,
  preview_status text not null default 'prepared'
    check (preview_status in ('prepared', 'reviewed', 'applied', 'rejected', 'archived')),
  diff_summary jsonb not null default '{}'::jsonb,
  patch_preview jsonb not null default '{}'::jsonb,
  safe_patch jsonb not null default '{}'::jsonb,
  blocked_patch jsonb not null default '{}'::jsonb,
  draft_sync_state jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_draft_applications_store_idx
  on public.ai_draft_applications(store_instance_id, application_status, created_at desc);

create index if not exists ai_suggestion_reviews_store_idx
  on public.ai_suggestion_reviews(store_instance_id, review_status, created_at desc);

create index if not exists ai_change_previews_store_idx
  on public.ai_change_previews(store_instance_id, preview_status, created_at desc);

alter table public.ai_draft_applications enable row level security;
alter table public.ai_suggestion_reviews enable row level security;
alter table public.ai_change_previews enable row level security;

do $$
declare
  managed_table text;
begin
  foreach managed_table in array array[
    'ai_draft_applications',
    'ai_suggestion_reviews',
    'ai_change_previews'
  ]
  loop
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = managed_table
        and policyname = 'Buyer store members read AI draft application records'
    ) then
      execute format(
        'create policy "Buyer store members read AI draft application records" on public.%I for select using (public.can_access_store_instance(store_instance_id))',
        managed_table
      );
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = managed_table
        and policyname = 'Buyer store managers write AI draft application records'
    ) then
      execute format(
        'create policy "Buyer store managers write AI draft application records" on public.%I for all using (public.can_manage_store_instance(store_instance_id)) with check (public.can_manage_store_instance(store_instance_id))',
        managed_table
      );
    end if;
  end loop;
end $$;

