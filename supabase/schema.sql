create extension if not exists "pgcrypto";

create type landing_page_status as enum ('draft', 'published', 'archived');
create type subscription_status as enum ('trialing', 'active', 'past_due', 'canceled', 'incomplete');
create type domain_status as enum ('pending', 'verified', 'failed');
create type publication_status as enum ('draft', 'published', 'unpublished');
create type project_type as enum ('landing', 'store');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  created_at timestamptz not null default now()
);

create table landing_pages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  template_id text not null,
  slug text not null unique,
  status landing_page_status not null default 'draft',
  product_name text not null,
  product_price text not null,
  product_description text not null,
  whatsapp_number text not null,
  brand_color text not null default '#0f172a',
  hero_image_url text,
  ai_copy jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  status subscription_status not null default 'incomplete',
  price_id text,
  current_period_end timestamptz,
  created_at timestamptz not null default now()
);

create table products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  short_description text not null,
  long_description text,
  price text not null,
  compare_price text,
  created_at timestamptz not null default now()
);

create table product_images (
  id uuid primary key default gen_random_uuid(),
  landing_page_id uuid not null references landing_pages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  public_url text not null,
  image_type text not null default 'gallery',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table landing_settings (
  id uuid primary key default gen_random_uuid(),
  landing_page_id uuid not null references landing_pages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  cta_text text not null,
  brand_color text not null default '#0f172a',
  whatsapp_number text not null,
  created_at timestamptz not null default now()
);

create table landing_payment_methods (
  id uuid primary key default gen_random_uuid(),
  landing_page_id uuid not null references landing_pages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  method text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text,
  default_whatsapp_number text,
  default_brand_color text not null default '#0f172a',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  project_type project_type not null default 'landing',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table stores (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid,
  name text not null,
  description text,
  logo_image_url text,
  brand_color text not null default '#0f172a',
  currency text not null default 'USD',
  whatsapp_number text,
  support_email text,
  support_phone text,
  business_address text,
  business_hours text,
  privacy_policy text,
  terms_of_service text,
  refund_policy text,
  delivery_enabled boolean not null default false,
  pickup_enabled boolean not null default false,
  delivery_fee numeric(12, 2),
  free_delivery_threshold numeric(12, 2),
  delivery_notes text,
  template_id text not null default 'modern-store',
  status publication_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table store_categories (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  image_url text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table store_products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  category_id uuid references store_categories(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  price text,
  image_url text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table store_templates (
  id text primary key,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table store_theme_settings (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null unique references stores(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  template_id text not null references store_templates(id),
  brand_color text not null default '#0f172a',
  logo_image_url text,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table store_orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  store_instance_id uuid references stores(id) on delete cascade,
  workspace_id uuid,
  user_id uuid references auth.users(id) on delete set null,
  owner_user_id uuid references auth.users(id) on delete set null,
  customer_name text not null,
  customer_phone text not null,
  customer_email text,
  customer_address text,
  items jsonb not null default '[]'::jsonb,
  subtotal numeric(12, 2) not null default 0 check (subtotal >= 0),
  total numeric(12, 2) not null default 0 check (total >= 0),
  payment_method text not null default 'manual',
  payment_status text not null default 'pending',
  order_status text not null default 'pending',
  fulfillment_status text not null default 'unfulfilled',
  delivery_method text,
  delivery_fee numeric(12, 2) not null default 0,
  preparing_at timestamptz,
  ready_for_pickup_at timestamptz,
  out_for_delivery_at timestamptz,
  fulfilled_at timestamptz,
  fulfillment_notes text,
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  internal_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table published_stores (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null unique references stores(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid,
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
  domain_status text not null default 'pending',
  domain_verified_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table templates (
  id text primary key,
  name text not null,
  category text not null,
  is_active boolean not null default true,
  schema jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table landings (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  landing_page_id uuid references landing_pages(id) on delete set null,
  title text not null,
  status publication_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  landing_page_id uuid references landing_pages(id) on delete set null,
  kind text not null,
  prompt jsonb not null,
  output jsonb not null,
  credits_used integer not null default 1,
  created_at timestamptz not null default now()
);

create table domains (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  hostname text not null unique,
  subdomain text unique,
  status domain_status not null default 'pending',
  verification_token text not null default encode(gen_random_bytes(24), 'hex'),
  dns_target text not null,
  created_at timestamptz not null default now(),
  verified_at timestamptz
);

create table publications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  landing_page_id uuid not null references landing_pages(id) on delete cascade,
  domain_id uuid references domains(id) on delete set null,
  url text not null,
  status publication_status not null default 'draft',
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create table plans (
  id text primary key,
  name text not null,
  stripe_price_id text,
  monthly_credits integer not null default 100,
  price_cents integer not null default 0,
  is_active boolean not null default true
);

create table credits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  balance integer not null default 0,
  updated_at timestamptz not null default now()
);

create table usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  quantity integer not null default 1,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;
alter table landing_pages enable row level security;
alter table subscriptions enable row level security;
alter table products enable row level security;
alter table product_images enable row level security;
alter table landing_settings enable row level security;
alter table landing_payment_methods enable row level security;
alter table users enable row level security;
alter table projects enable row level security;
alter table stores enable row level security;
alter table store_categories enable row level security;
alter table store_products enable row level security;
alter table store_templates enable row level security;
alter table store_theme_settings enable row level security;
alter table store_orders enable row level security;
alter table published_stores enable row level security;
alter table templates enable row level security;
alter table landings enable row level security;
alter table generations enable row level security;
alter table domains enable row level security;
alter table publications enable row level security;
alter table plans enable row level security;
alter table credits enable row level security;
alter table usage_events enable row level security;

create policy "Users can read own profile" on profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);

create policy "Users manage own landing pages" on landing_pages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Published landing pages are public" on landing_pages
  for select using (status = 'published' or auth.uid() = user_id);

create policy "Users read own subscriptions" on subscriptions for select using (auth.uid() = user_id);
create policy "Users manage own products" on products
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own product images" on product_images
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own landing settings" on landing_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own payment methods" on landing_payment_methods
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage own user row" on users
  for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "Users manage own projects" on projects
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own stores" on stores
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own store categories" on store_categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own store products" on store_products
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Store templates are readable" on store_templates
  for select using (is_active = true);
create policy "Users manage own store theme settings" on store_theme_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own published stores" on published_stores
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Published stores are public" on published_stores
  for select using (status = 'published' or auth.uid() = user_id);
create policy "Templates are readable" on templates for select using (is_active = true);
create policy "Users manage own landings" on landings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users read own generations" on generations for select using (auth.uid() = user_id);
create policy "Users create own generations" on generations for insert with check (auth.uid() = user_id);
create policy "Users manage own domains" on domains
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own publications" on publications
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Plans are readable" on plans for select using (is_active = true);
create policy "Users read own credits" on credits for select using (auth.uid() = user_id);
create policy "Users read own usage" on usage_events for select using (auth.uid() = user_id);

create index landing_pages_user_id_idx on landing_pages(user_id);
create index landing_pages_slug_idx on landing_pages(slug);
create index product_images_landing_page_id_idx on product_images(landing_page_id);
create index projects_user_id_idx on projects(user_id);
create index stores_user_id_idx on stores(user_id);
create index stores_project_id_idx on stores(project_id);
create index store_categories_store_id_idx on store_categories(store_id);
create index store_products_store_id_idx on store_products(store_id);
create index store_products_category_id_idx on store_products(category_id);
create index store_theme_settings_store_id_idx on store_theme_settings(store_id);
create index published_stores_slug_idx on published_stores(slug);
create index published_stores_store_id_idx on published_stores(store_id);
create index store_orders_store_created_idx on store_orders(store_id, created_at desc);
create index store_orders_workspace_id_idx on store_orders(workspace_id);
create index store_orders_store_instance_id_idx on store_orders(store_instance_id);
create index store_orders_workspace_created_idx on store_orders(workspace_id, created_at desc);
create index store_orders_fulfillment_status_idx on store_orders(workspace_id, fulfillment_status, created_at desc);
create index store_orders_fulfilled_at_idx on store_orders(workspace_id, fulfilled_at desc);
create index landings_user_id_idx on landings(user_id);
create index generations_user_id_idx on generations(user_id);
create index domains_user_id_idx on domains(user_id);
create index publications_landing_page_id_idx on publications(landing_page_id);
create index usage_events_user_id_idx on usage_events(user_id);

insert into templates (id, name, category)
values
  ('minimal', 'Minimal', 'product'),
  ('luxury', 'Luxury', 'product'),
  ('beauty', 'Beauty', 'beauty'),
  ('gadget', 'Gadget', 'electronics'),
  ('fashion', 'Fashion', 'fashion'),
  ('saas', 'SaaS', 'software'),
  ('local-business', 'Local Business', 'services')
on conflict (id) do update set name = excluded.name, category = excluded.category;

insert into store_templates (id, name, description)
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

insert into plans (id, name, monthly_credits, price_cents)
values
  ('starter', 'Starter', 100, 1900),
  ('growth', 'Growth', 500, 4900),
  ('scale', 'Scale', 1500, 9900)
on conflict (id) do update set
  name = excluded.name,
  monthly_credits = excluded.monthly_credits,
  price_cents = excluded.price_cents;

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

create policy "Users upload own product images" on storage.objects
  for insert with check (
    bucket_id = 'product-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Product images are public" on storage.objects
  for select using (bucket_id = 'product-images');

-- =============================================================================
-- EXISTING DATABASES: do not re-run this full file if objects already exist.
-- Use the idempotent store migration instead:
--   supabase/migrations/store-system-safe.sql
-- If checkout fails with column "visibility" does not exist, also run:
--   supabase/migrations/fix-published-stores-visibility-safe.sql
-- =============================================================================
