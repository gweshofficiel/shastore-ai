-- AI template customization foundation.
-- Additive only: stores simulated template customization requests and suggestions
-- without real AI calls, API keys, storefront rendering changes, checkout, payments,
-- products, reseller, provisioning, domains, or tenant routing changes.

create extension if not exists "pgcrypto";

create table if not exists public.ai_branding_profiles (
  id uuid primary key default gen_random_uuid(),
  store_instance_id uuid not null references public.store_instances(id) on delete cascade,
  owner_user_id uuid references auth.users(id) on delete cascade,
  template_id text,
  niche text not null default '',
  business_description text not null default '',
  target_audience text not null default 'general_buyers',
  brand_tone text not null default 'modern',
  profile_status text not null default 'draft'
    check (profile_status in ('draft', 'ready', 'applied', 'archived')),
  branding_tokens jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_template_customizations (
  id uuid primary key default gen_random_uuid(),
  store_instance_id uuid not null references public.store_instances(id) on delete cascade,
  owner_user_id uuid references auth.users(id) on delete cascade,
  template_id text not null,
  branding_profile_id uuid references public.ai_branding_profiles(id) on delete set null,
  builder_page_id uuid references public.builder_pages(id) on delete set null,
  builder_draft_id uuid references public.builder_drafts(id) on delete set null,
  customization_status text not null default 'draft'
    check (customization_status in ('draft', 'prepared', 'previewed', 'applied', 'failed', 'archived')),
  input_payload jsonb not null default '{}'::jsonb,
  prompt_preview text not null default '',
  suggested_changes jsonb not null default '{}'::jsonb,
  applied_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_layout_suggestions (
  id uuid primary key default gen_random_uuid(),
  customization_id uuid not null references public.ai_template_customizations(id) on delete cascade,
  store_instance_id uuid not null references public.store_instances(id) on delete cascade,
  owner_user_id uuid references auth.users(id) on delete cascade,
  template_id text not null,
  suggestion_status text not null default 'preview'
    check (suggestion_status in ('preview', 'accepted', 'rejected', 'archived')),
  layout_suggestion jsonb not null default '{}'::jsonb,
  section_suggestions jsonb not null default '[]'::jsonb,
  conversion_notes jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_copy_suggestions (
  id uuid primary key default gen_random_uuid(),
  customization_id uuid not null references public.ai_template_customizations(id) on delete cascade,
  store_instance_id uuid not null references public.store_instances(id) on delete cascade,
  owner_user_id uuid references auth.users(id) on delete cascade,
  template_id text not null,
  suggestion_status text not null default 'preview'
    check (suggestion_status in ('preview', 'accepted', 'rejected', 'archived')),
  hero_copy jsonb not null default '{}'::jsonb,
  cta_copy jsonb not null default '{}'::jsonb,
  section_copy jsonb not null default '[]'::jsonb,
  multilingual_notes jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_branding_profiles_store_idx
  on public.ai_branding_profiles(store_instance_id, updated_at desc);

create index if not exists ai_template_customizations_store_idx
  on public.ai_template_customizations(store_instance_id, updated_at desc);

create index if not exists ai_template_customizations_template_idx
  on public.ai_template_customizations(template_id, created_at desc);

create index if not exists ai_layout_suggestions_customization_idx
  on public.ai_layout_suggestions(customization_id, created_at desc);

create index if not exists ai_copy_suggestions_customization_idx
  on public.ai_copy_suggestions(customization_id, created_at desc);

alter table public.ai_branding_profiles enable row level security;
alter table public.ai_template_customizations enable row level security;
alter table public.ai_layout_suggestions enable row level security;
alter table public.ai_copy_suggestions enable row level security;

do $$
declare
  managed_table text;
begin
  foreach managed_table in array array[
    'ai_branding_profiles',
    'ai_template_customizations',
    'ai_layout_suggestions',
    'ai_copy_suggestions'
  ]
  loop
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = managed_table
        and policyname = 'Buyer store members read AI template customization records'
    ) then
      execute format(
        'create policy "Buyer store members read AI template customization records" on public.%I for select using (public.can_access_store_instance(store_instance_id))',
        managed_table
      );
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = managed_table
        and policyname = 'Buyer store managers write AI template customization records'
    ) then
      execute format(
        'create policy "Buyer store managers write AI template customization records" on public.%I for all using (public.can_manage_store_instance(store_instance_id)) with check (public.can_manage_store_instance(store_instance_id))',
        managed_table
      );
    end if;
  end loop;
end $$;
