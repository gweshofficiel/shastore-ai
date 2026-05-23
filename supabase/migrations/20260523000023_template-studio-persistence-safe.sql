-- Template Studio action persistence for SHASTORE AI.
-- Additive only: does not touch billing, checkout, shipping, seller payments,
-- auth core, admin billing, or reseller showcase route structure.

create table if not exists public.template_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reseller_id uuid,
  template_key text not null,
  source_template_key text not null,
  duplicated_from_draft_id uuid references public.template_drafts(id) on delete set null,
  title text not null,
  status text not null default 'draft' check (status in ('draft', 'published', 'unpublished', 'duplicated', 'restored')),
  branding jsonb not null default '{}'::jsonb,
  colors jsonb not null default '{}'::jsonb,
  products jsonb not null default '[]'::jsonb,
  categories jsonb not null default '[]'::jsonb,
  footer_settings jsonb not null default '{}'::jsonb,
  seo jsonb not null default '{}'::jsonb,
  cta jsonb not null default '{}'::jsonb,
  homepage_content jsonb not null default '{}'::jsonb,
  customization jsonb not null default '{}'::jsonb,
  template_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, template_key)
);

create table if not exists public.template_publications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reseller_id uuid,
  template_key text not null,
  draft_id uuid references public.template_drafts(id) on delete set null,
  showcase_item_id uuid,
  status text not null default 'published' check (status in ('published', 'unpublished')),
  preview_card jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  unpublished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, template_key)
);

create index if not exists template_drafts_user_template_idx
  on public.template_drafts(user_id, template_key);

create index if not exists template_drafts_reseller_id_idx
  on public.template_drafts(reseller_id);

create index if not exists template_publications_user_template_idx
  on public.template_publications(user_id, template_key);

create index if not exists template_publications_reseller_id_idx
  on public.template_publications(reseller_id);

alter table public.template_drafts enable row level security;
alter table public.template_publications enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'template_drafts'
      and policyname = 'Users manage own template drafts'
  ) then
    create policy "Users manage own template drafts"
      on public.template_drafts for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'template_publications'
      and policyname = 'Users manage own template publications'
  ) then
    create policy "Users manage own template publications"
      on public.template_publications for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

create or replace function public.set_template_studio_persistence_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'template_drafts_updated_at') then
    create trigger template_drafts_updated_at
      before update on public.template_drafts
      for each row execute function public.set_template_studio_persistence_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'template_publications_updated_at') then
    create trigger template_publications_updated_at
      before update on public.template_publications
      for each row execute function public.set_template_studio_persistence_updated_at();
  end if;
end $$;

