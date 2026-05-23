-- Store themes and layout engine foundation.
-- Additive only: prepares tenant-scoped theme rendering without changing products, checkout, reseller, provisioning, domains, or publish logic.

create extension if not exists "pgcrypto";

create table if not exists public.store_themes (
  id uuid primary key default gen_random_uuid(),
  store_instance_id uuid not null references public.store_instances(id) on delete cascade,
  owner_user_id uuid references auth.users(id) on delete cascade,
  theme_id text not null default 'shastore-modern',
  theme_key text not null default 'modern',
  layout_key text not null default 'classic',
  is_active boolean not null default true,
  typography jsonb not null default '{"heading":"inter","body":"inter","scale":"comfortable"}'::jsonb,
  border_radius text not null default '2rem'
    check (border_radius in ('0.75rem', '1rem', '1.5rem', '2rem', '2.5rem')),
  spacing text not null default 'comfortable'
    check (spacing in ('compact', 'comfortable', 'spacious')),
  color_palette jsonb not null default '{"primary":"#0f172a","secondary":"#2563eb","accent":"#f59e0b","background":"#f8fafc","surface":"#ffffff","text":"#0f172a","muted":"#64748b"}'::jsonb,
  logo_config jsonb not null default '{"mode":"text","url":null,"alt":null}'::jsonb,
  style_config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.store_themes
  add column if not exists owner_user_id uuid references auth.users(id) on delete cascade,
  add column if not exists theme_id text not null default 'shastore-modern',
  add column if not exists theme_key text not null default 'modern',
  add column if not exists layout_key text not null default 'classic',
  add column if not exists is_active boolean not null default true,
  add column if not exists typography jsonb not null default '{"heading":"inter","body":"inter","scale":"comfortable"}'::jsonb,
  add column if not exists border_radius text not null default '2rem',
  add column if not exists spacing text not null default 'comfortable',
  add column if not exists color_palette jsonb not null default '{"primary":"#0f172a","secondary":"#2563eb","accent":"#f59e0b","background":"#f8fafc","surface":"#ffffff","text":"#0f172a","muted":"#64748b"}'::jsonb,
  add column if not exists logo_config jsonb not null default '{"mode":"text","url":null,"alt":null}'::jsonb,
  add column if not exists style_config jsonb not null default '{}'::jsonb;

update public.store_themes themes
set owner_user_id = instances.owner_user_id
from public.store_instances instances
where themes.store_instance_id = instances.id
  and themes.owner_user_id is null;

create unique index if not exists store_themes_one_active_idx
  on public.store_themes(store_instance_id)
  where is_active;

create index if not exists store_themes_owner_idx
  on public.store_themes(owner_user_id, updated_at desc);

create index if not exists store_themes_instance_idx
  on public.store_themes(store_instance_id, is_active);

alter table public.store_themes enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'store_themes'
      and policyname = 'Buyer store members read store themes'
  ) then
    create policy "Buyer store members read store themes"
      on public.store_themes for select
      using (public.can_access_store_instance(store_instance_id));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'store_themes'
      and policyname = 'Buyer store managers write store themes'
  ) then
    create policy "Buyer store managers write store themes"
      on public.store_themes for all
      using (public.can_manage_store_instance(store_instance_id))
      with check (public.can_manage_store_instance(store_instance_id));
  end if;
end $$;

create or replace function public.set_store_themes_updated_at()
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
  if not exists (select 1 from pg_trigger where tgname = 'store_themes_updated_at') then
    create trigger store_themes_updated_at
      before update on public.store_themes
      for each row execute function public.set_store_themes_updated_at();
  end if;
end $$;

