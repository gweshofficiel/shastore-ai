-- Reseller showcase and store marketplace foundation for SHASTORE AI.
-- Additive only: does not touch billing, checkout, orders, domains, auth, or storefront rendering.

create table if not exists public.reseller_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  slug text not null unique,
  display_name text not null,
  logo_url text,
  banner_url text,
  bio text,
  website_url text,
  instagram_url text,
  tiktok_url text,
  theme_id text not null default 'minimal' check (theme_id in ('minimal', 'modern', 'dark-premium', 'agency')),
  primary_color text not null default '#0f172a',
  accent_color text not null default '#2563eb',
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.showcase_theme_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid not null unique references public.reseller_profiles(id) on delete cascade,
  theme_id text not null default 'minimal' check (theme_id in ('minimal', 'modern', 'dark-premium', 'agency')),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reseller_showcase_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid not null references public.reseller_profiles(id) on delete cascade,
  source_store_id uuid,
  slug text not null,
  title text not null,
  status text not null default 'draft' check (status in ('draft', 'published', 'unpublished')),
  thumbnail_url text,
  preview_images jsonb not null default '[]'::jsonb,
  category text,
  price_label text,
  description text,
  features jsonb not null default '[]'::jsonb,
  demo_url text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, slug)
);

create index if not exists reseller_profiles_slug_idx on public.reseller_profiles(slug);
create index if not exists reseller_profiles_user_id_idx on public.reseller_profiles(user_id);
create index if not exists reseller_showcase_items_profile_status_idx
  on public.reseller_showcase_items(profile_id, status, sort_order);
create index if not exists reseller_showcase_items_user_id_idx
  on public.reseller_showcase_items(user_id);

alter table public.reseller_profiles enable row level security;
alter table public.showcase_theme_settings enable row level security;
alter table public.reseller_showcase_items enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'reseller_profiles'
      and policyname = 'Users manage own reseller profile'
  ) then
    create policy "Users manage own reseller profile"
      on public.reseller_profiles for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'reseller_profiles'
      and policyname = 'Public read published reseller profiles'
  ) then
    create policy "Public read published reseller profiles"
      on public.reseller_profiles for select
      using (is_published = true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'showcase_theme_settings'
      and policyname = 'Users manage own showcase theme settings'
  ) then
    create policy "Users manage own showcase theme settings"
      on public.showcase_theme_settings for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'showcase_theme_settings'
      and policyname = 'Public read published showcase theme settings'
  ) then
    create policy "Public read published showcase theme settings"
      on public.showcase_theme_settings for select
      using (
        exists (
          select 1
          from public.reseller_profiles profiles
          where profiles.id = showcase_theme_settings.profile_id
            and profiles.is_published = true
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'reseller_showcase_items'
      and policyname = 'Users manage own reseller showcase items'
  ) then
    create policy "Users manage own reseller showcase items"
      on public.reseller_showcase_items for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'reseller_showcase_items'
      and policyname = 'Public read published reseller showcase items'
  ) then
    create policy "Public read published reseller showcase items"
      on public.reseller_showcase_items for select
      using (
        status = 'published'
        and exists (
          select 1
          from public.reseller_profiles profiles
          where profiles.id = reseller_showcase_items.profile_id
            and profiles.is_published = true
        )
      );
  end if;
end $$;

create or replace function public.set_reseller_showcase_updated_at()
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
  if not exists (select 1 from pg_trigger where tgname = 'reseller_profiles_updated_at') then
    create trigger reseller_profiles_updated_at
      before update on public.reseller_profiles
      for each row execute function public.set_reseller_showcase_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'showcase_theme_settings_updated_at') then
    create trigger showcase_theme_settings_updated_at
      before update on public.showcase_theme_settings
      for each row execute function public.set_reseller_showcase_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'reseller_showcase_items_updated_at') then
    create trigger reseller_showcase_items_updated_at
      before update on public.reseller_showcase_items
      for each row execute function public.set_reseller_showcase_updated_at();
  end if;
end $$;
