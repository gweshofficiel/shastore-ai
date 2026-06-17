-- Template registry foundation for Super Admin Template Management Center.
-- Additive only: does not modify storefront runtime, store builder, store themes,
-- template package installer, template rendering engine, or customer stores.

create extension if not exists "pgcrypto";

create table if not exists public.template_registry (
  id uuid primary key default gen_random_uuid(),
  template_key text unique not null,
  name text not null,
  slug text unique not null,
  category text,
  industry text,
  status text not null default 'active',
  visibility text not null default 'owner',
  version text not null default '1',
  badges jsonb not null default '[]'::jsonb,
  package_summary jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  is_official boolean not null default false,
  is_recommended boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint template_registry_status_check
    check (status in ('active', 'draft', 'archived')),
  constraint template_registry_visibility_check
    check (visibility in ('owner', 'reseller', 'marketplace', 'internal'))
);

create index if not exists template_registry_status_idx
  on public.template_registry(status, visibility);

create index if not exists template_registry_category_idx
  on public.template_registry(category, industry);

alter table public.template_registry enable row level security;

drop policy if exists "service role can manage template registry" on public.template_registry;
create policy "service role can manage template registry"
on public.template_registry
for all
to service_role
using (true)
with check (true);

create or replace function public.template_registry_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists template_registry_updated_at on public.template_registry;
create trigger template_registry_updated_at
before update on public.template_registry
for each row execute function public.template_registry_set_updated_at();

insert into public.template_registry (
  template_key,
  name,
  slug,
  category,
  industry,
  status,
  visibility,
  version,
  badges,
  package_summary,
  metadata,
  is_official,
  is_recommended
) values
  (
    'shastore-flagship-premium',
    'SHASTORE Flagship Premium',
    'shastore-flagship-premium',
    'multi-purpose',
    'multi-purpose',
    'active',
    'marketplace',
    '1',
    '["official","recommended","premium","ready-to-use"]'::jsonb,
    '{"aiVisualSupport":true,"blogCount":2,"categoriesCount":8,"domainEmailReadiness":"ready","faqCount":4,"pagesCount":9,"productsCount":6}'::jsonb,
    '{"source":"template_registry_seed","storeTemplateId":"shastore-flagship-premium"}'::jsonb,
    true,
    true
  ),
  (
    'multi-purpose-starter',
    'Multi-purpose Starter',
    'multi-purpose-starter',
    'multi-purpose',
    'multi-purpose',
    'active',
    'owner',
    '1',
    '["starter"]'::jsonb,
    '{"aiVisualSupport":true,"blogCount":0,"categoriesCount":0,"domainEmailReadiness":"placeholder","faqCount":0,"pagesCount":1,"productsCount":0}'::jsonb,
    '{"source":"template_registry_seed","storeTemplateId":"multi-purpose-starter"}'::jsonb,
    false,
    false
  ),
  (
    'fashion-starter',
    'Fashion Starter',
    'fashion-starter',
    'fashion',
    'fashion',
    'active',
    'owner',
    '1',
    '["starter"]'::jsonb,
    '{"aiVisualSupport":true,"blogCount":0,"categoriesCount":0,"domainEmailReadiness":"placeholder","faqCount":0,"pagesCount":1,"productsCount":0}'::jsonb,
    '{"source":"template_registry_seed","storeTemplateId":"fashion-starter"}'::jsonb,
    false,
    false
  ),
  (
    'electronics-starter',
    'Electronics Starter',
    'electronics-starter',
    'electronics',
    'electronics',
    'active',
    'owner',
    '1',
    '["starter"]'::jsonb,
    '{"aiVisualSupport":true,"blogCount":0,"categoriesCount":0,"domainEmailReadiness":"placeholder","faqCount":0,"pagesCount":1,"productsCount":0}'::jsonb,
    '{"source":"template_registry_seed","storeTemplateId":"electronics-starter"}'::jsonb,
    false,
    false
  ),
  (
    'beauty-starter',
    'Beauty Starter',
    'beauty-starter',
    'beauty',
    'beauty',
    'active',
    'owner',
    '1',
    '["starter"]'::jsonb,
    '{"aiVisualSupport":true,"blogCount":0,"categoriesCount":0,"domainEmailReadiness":"placeholder","faqCount":0,"pagesCount":1,"productsCount":0}'::jsonb,
    '{"source":"template_registry_seed","storeTemplateId":"beauty-starter"}'::jsonb,
    false,
    false
  ),
  (
    'perfume-starter',
    'Perfume Starter',
    'perfume-starter',
    'perfume',
    'perfume',
    'active',
    'owner',
    '1',
    '["starter"]'::jsonb,
    '{"aiVisualSupport":true,"blogCount":0,"categoriesCount":0,"domainEmailReadiness":"placeholder","faqCount":0,"pagesCount":1,"productsCount":0}'::jsonb,
    '{"source":"template_registry_seed","storeTemplateId":"perfume-starter"}'::jsonb,
    false,
    false
  ),
  (
    'restaurant-starter',
    'Restaurant Starter',
    'restaurant-starter',
    'restaurant',
    'restaurant',
    'active',
    'owner',
    '1',
    '["starter"]'::jsonb,
    '{"aiVisualSupport":true,"blogCount":0,"categoriesCount":0,"domainEmailReadiness":"placeholder","faqCount":0,"pagesCount":1,"productsCount":0}'::jsonb,
    '{"source":"template_registry_seed","storeTemplateId":"restaurant-starter"}'::jsonb,
    false,
    false
  ),
  (
    'jewelry-starter',
    'Jewelry Starter',
    'jewelry-starter',
    'jewelry',
    'jewelry',
    'active',
    'owner',
    '1',
    '["starter"]'::jsonb,
    '{"aiVisualSupport":true,"blogCount":0,"categoriesCount":0,"domainEmailReadiness":"placeholder","faqCount":0,"pagesCount":1,"productsCount":0}'::jsonb,
    '{"source":"template_registry_seed","storeTemplateId":"jewelry-starter"}'::jsonb,
    false,
    false
  ),
  (
    'general-starter',
    'General Starter',
    'general-starter',
    'general',
    'general',
    'active',
    'owner',
    '1',
    '["starter"]'::jsonb,
    '{"aiVisualSupport":true,"blogCount":0,"categoriesCount":0,"domainEmailReadiness":"placeholder","faqCount":0,"pagesCount":1,"productsCount":0}'::jsonb,
    '{"source":"template_registry_seed","storeTemplateId":"general-starter"}'::jsonb,
    false,
    false
  ),
  (
    'aurora-pro',
    'Aurora Pro',
    'aurora-pro',
    'premium',
    'premium',
    'active',
    'marketplace',
    '1',
    '["recommended","premium"]'::jsonb,
    '{"aiVisualSupport":true,"blogCount":0,"categoriesCount":0,"domainEmailReadiness":"placeholder","faqCount":0,"pagesCount":1,"productsCount":0}'::jsonb,
    '{"source":"template_registry_seed","storeTemplateId":"aurora-pro"}'::jsonb,
    false,
    true
  )
on conflict (template_key) do nothing;
