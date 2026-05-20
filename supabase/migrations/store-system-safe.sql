-- SHASTORE AI — Store system safe migration (idempotent)
-- Run this in Supabase SQL Editor on an existing production database.
-- Does NOT recreate landing tables, enums, policies, or storage buckets that already exist.
-- Does NOT drop data.

-- ---------------------------------------------------------------------------
-- Enums (only create when missing)
-- ---------------------------------------------------------------------------
do $$
begin
  create type publication_status as enum ('draft', 'published', 'unpublished');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type project_type as enum ('landing', 'store');
exception
  when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- projects.project_type (add column to existing table)
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'projects'
      and column_name = 'project_type'
  ) then
    alter table public.projects
      add column project_type project_type not null default 'landing';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Store tables
-- ---------------------------------------------------------------------------
create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  logo_image_url text,
  brand_color text not null default '#0f172a',
  currency text not null default 'USD',
  whatsapp_number text,
  template_id text not null default 'minimal-luxury',
  status publication_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.store_categories (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  image_url text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.store_products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  category_id uuid references public.store_categories(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  price text,
  image_url text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.store_templates (
  id text primary key,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.store_theme_settings (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null unique references public.stores(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  template_id text not null references public.store_templates(id),
  brand_color text not null default '#0f172a',
  logo_image_url text,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.published_stores (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null unique references public.stores(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  slug text not null unique,
  url text not null,
  status publication_status not null default 'draft',
  visibility text not null default 'public',
  seo_title text,
  seo_description text,
  og_title text,
  og_description text,
  favicon_url text,
  social_image_url text,
  custom_domain text,
  subdomain text,
  hostname text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Publication foundation columns (safe for existing published_stores tables)
-- ---------------------------------------------------------------------------
alter table public.published_stores
  add column if not exists visibility text not null default 'public',
  add column if not exists seo_title text,
  add column if not exists seo_description text,
  add column if not exists og_title text,
  add column if not exists og_description text,
  add column if not exists favicon_url text,
  add column if not exists social_image_url text,
  add column if not exists custom_domain text,
  add column if not exists subdomain text,
  add column if not exists hostname text;

-- ---------------------------------------------------------------------------
-- Row level security (safe to re-run)
-- ---------------------------------------------------------------------------
alter table public.stores enable row level security;
alter table public.store_categories enable row level security;
alter table public.store_products enable row level security;
alter table public.store_templates enable row level security;
alter table public.store_theme_settings enable row level security;
alter table public.published_stores enable row level security;

-- ---------------------------------------------------------------------------
-- Policies (create only if missing)
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'stores' and policyname = 'Users manage own stores'
  ) then
    create policy "Users manage own stores" on public.stores
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'store_categories' and policyname = 'Users manage own store categories'
  ) then
    create policy "Users manage own store categories" on public.store_categories
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'store_products' and policyname = 'Users manage own store products'
  ) then
    create policy "Users manage own store products" on public.store_products
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'store_templates' and policyname = 'Store templates are readable'
  ) then
    create policy "Store templates are readable" on public.store_templates
      for select using (is_active = true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'store_theme_settings' and policyname = 'Users manage own store theme settings'
  ) then
    create policy "Users manage own store theme settings" on public.store_theme_settings
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'published_stores' and policyname = 'Users manage own published stores'
  ) then
    create policy "Users manage own published stores" on public.published_stores
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'published_stores' and policyname = 'Published stores are public'
  ) then
    create policy "Published stores are public" on public.published_stores
      for select using (status = 'published' or auth.uid() = user_id);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index if not exists stores_user_id_idx on public.stores(user_id);
create index if not exists stores_project_id_idx on public.stores(project_id);
create index if not exists store_categories_store_id_idx on public.store_categories(store_id);
create index if not exists store_products_store_id_idx on public.store_products(store_id);
create index if not exists store_products_category_id_idx on public.store_products(category_id);
create index if not exists store_theme_settings_store_id_idx on public.store_theme_settings(store_id);
create index if not exists published_stores_slug_idx on public.published_stores(slug);
create index if not exists published_stores_store_id_idx on public.published_stores(store_id);
create index if not exists published_stores_hostname_idx on public.published_stores(hostname);
create index if not exists published_stores_visibility_idx on public.published_stores(visibility);

-- ---------------------------------------------------------------------------
-- Store template seeds (upsert only)
-- ---------------------------------------------------------------------------
insert into public.store_templates (id, name, description)
values
  ('minimal-luxury', 'Minimal Luxury', 'Clean editorial commerce for premium products.'),
  ('fashion-modern', 'Fashion Modern', 'Bold fashion storefront with strong category merchandising.'),
  ('electronics-dark', 'Electronics Dark', 'Dark high-contrast layout for electronics and gadgets.'),
  ('beauty-glow', 'Beauty Glow', 'Soft polished beauty storefront with warm sections.'),
  ('marketplace-grid', 'Marketplace Grid', 'Grid-first catalog for multi-category shopping.'),
  ('premium-brand', 'Premium Brand', 'Brand-led storefront for elevated product collections.'),
  ('gadget-neon', 'Gadget Neon', 'Neon-accented store for modern tech products.'),
  ('clean-scandinavian', 'Clean Scandinavian', 'Minimal airy catalog with calm product presentation.'),
  ('arabic-luxury', 'Arabic Luxury', 'Elegant RTL-ready luxury storefront direction.'),
  ('tiktok-product-store', 'TikTok Product Store', 'Fast social-commerce layout for viral products.')
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description;
