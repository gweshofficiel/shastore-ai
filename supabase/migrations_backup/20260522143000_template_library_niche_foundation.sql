-- Template library and niche store template foundation.
-- Additive only: prepares ready-made storefront templates without changing products, orders, checkout,
-- reseller flows, provisioning, domains, tenant routing, or storefront rendering.

create extension if not exists "pgcrypto";

alter table public.template_categories
  drop constraint if exists template_categories_category_key_check;

alter table public.template_categories
  add constraint template_categories_category_key_check
  check (
    category_key in (
      'fashion',
      'jewelry',
      'electronics',
      'beauty',
      'food',
      'furniture',
      'fitness',
      'kids',
      'digital',
      'marketplace',
      'perfumes',
      'watches',
      'gym',
      'pets',
      'restaurants',
      'cafes',
      'gadgets'
    )
  );

alter table public.store_templates
  add column if not exists template_slug text,
  add column if not exists niche_category text,
  add column if not exists preview_summary text,
  add column if not exists preview_config jsonb not null default '{}'::jsonb,
  add column if not exists layout_schema jsonb not null default '{"version":1,"sections":[]}'::jsonb,
  add column if not exists sections_schema jsonb not null default '[]'::jsonb,
  add column if not exists branding_config jsonb not null default '{}'::jsonb,
  add column if not exists theme_config jsonb not null default '{}'::jsonb,
  add column if not exists ai_customization_config jsonb not null default '{}'::jsonb,
  add column if not exists responsive_preview_config jsonb not null default '{}'::jsonb;

update public.store_templates
set
  template_slug = coalesce(template_slug, template_key, id),
  niche_category = coalesce(niche_category, category_key),
  preview_summary = coalesce(preview_summary, description)
where template_slug is null
   or niche_category is null
   or preview_summary is null;

create unique index if not exists store_templates_template_slug_idx
  on public.store_templates(template_slug);

create index if not exists store_templates_niche_category_idx
  on public.store_templates(niche_category);

create table if not exists public.template_sections (
  id uuid primary key default gen_random_uuid(),
  template_id text not null references public.store_templates(id) on delete cascade,
  section_key text not null,
  section_type text not null check (
    section_type in (
      'hero',
      'banner',
      'product_grid',
      'featured_products',
      'rich_text',
      'image',
      'CTA',
      'testimonials',
      'newsletter',
      'spacer'
    )
  ),
  section_order integer not null default 0,
  section_schema jsonb not null default '{}'::jsonb,
  ai_customization_hints jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (template_id, section_key)
);

create table if not exists public.template_theme_configs (
  id uuid primary key default gen_random_uuid(),
  template_id text not null references public.store_templates(id) on delete cascade,
  theme_key text not null default 'modern',
  layout_key text not null default 'classic',
  typography jsonb not null default '{}'::jsonb,
  color_palette jsonb not null default '{}'::jsonb,
  spacing text not null default 'comfortable',
  border_radius text not null default '2rem',
  style_config jsonb not null default '{}'::jsonb,
  ai_branding_hints jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (template_id)
);

create table if not exists public.template_preview_assets (
  id uuid primary key default gen_random_uuid(),
  template_id text not null references public.store_templates(id) on delete cascade,
  asset_key text not null,
  asset_type text not null default 'placeholder'
    check (asset_type in ('placeholder', 'gradient', 'image', 'icon', 'mockup')),
  asset_url text,
  alt_text text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (template_id, asset_key)
);

create index if not exists template_sections_template_order_idx
  on public.template_sections(template_id, section_order);

create index if not exists template_theme_configs_template_idx
  on public.template_theme_configs(template_id);

create index if not exists template_preview_assets_template_idx
  on public.template_preview_assets(template_id);

alter table public.template_sections enable row level security;
alter table public.template_theme_configs enable row level security;
alter table public.template_preview_assets enable row level security;

do $$
declare
  managed_table text;
begin
  foreach managed_table in array array[
    'template_sections',
    'template_theme_configs',
    'template_preview_assets'
  ]
  loop
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = managed_table
        and policyname = 'Authenticated users can read template foundation records'
    ) then
      execute format(
        'create policy "Authenticated users can read template foundation records" on public.%I for select using (auth.uid() is not null)',
        managed_table
      );
    end if;
  end loop;
end $$;

create or replace function public.set_template_foundation_updated_at()
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
  if not exists (select 1 from pg_trigger where tgname = 'template_sections_updated_at') then
    create trigger template_sections_updated_at
      before update on public.template_sections
      for each row execute function public.set_template_foundation_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'template_theme_configs_updated_at') then
    create trigger template_theme_configs_updated_at
      before update on public.template_theme_configs
      for each row execute function public.set_template_foundation_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'template_preview_assets_updated_at') then
    create trigger template_preview_assets_updated_at
      before update on public.template_preview_assets
      for each row execute function public.set_template_foundation_updated_at();
  end if;
end $$;

insert into public.template_categories (
  category_key,
  name,
  description,
  locked_category_mapping,
  sort_order
)
values
  ('perfumes', 'Perfumes Store', 'Fragrance discovery, notes, gifting, and premium product storytelling.', 'perfumes', 110),
  ('watches', 'Watches Store', 'Timepiece collections, materials, lifestyle edits, and trust sections.', 'watches', 120),
  ('gym', 'Gym Store', 'Fitness gear, classes, supplements, and performance bundles.', 'gym', 130),
  ('pets', 'Pets Store', 'Pet food, accessories, care routines, and friendly recommendations.', 'pets', 140),
  ('restaurants', 'Restaurants Store', 'Menus, chef specials, reservation CTAs, and delivery highlights.', 'restaurants', 150),
  ('cafes', 'Cafes Store', 'Cafe menus, seasonal drinks, loyalty offers, and local ambience.', 'cafes', 160),
  ('gadgets', 'Gadgets Store', 'Smart accessories, device bundles, comparisons, and launch offers.', 'gadgets', 170)
on conflict (category_key) do update set
  name = excluded.name,
  description = excluded.description,
  locked_category_mapping = excluded.locked_category_mapping,
  sort_order = excluded.sort_order;

insert into public.store_templates (
  id,
  template_key,
  name,
  description,
  category_key,
  protected_category_key,
  template_kind,
  preview_gradient,
  homepage_text,
  demo_sections,
  demo_offers,
  default_customization,
  template_slug,
  niche_category,
  preview_summary,
  preview_config,
  layout_schema,
  sections_schema,
  branding_config,
  theme_config,
  ai_customization_config,
  responsive_preview_config
)
values
  ('perfumes-signature', 'perfumes-signature', 'Perfumes Signature', 'Premium fragrance storefront for collections, notes, and gifting.', 'perfumes', 'perfumes', 'physical', 'linear-gradient(135deg,#fff7ed,#7c2d12 54%,#111827)', '{"headline":"Signature scents for every mood","eyebrow":"Fragrance edit"}', '[{"title":"Shop by scent family"},{"title":"Feature gifting rituals"}]', '[{"title":"Discovery Set","code":"SCENT15"}]', '{"ctaText":"Find your signature scent"}', 'perfumes-signature', 'perfumes', 'Fragrance template with scent notes, gifting, and collection sections.', '{"devices":["desktop","tablet","mobile"]}', '{"version":1,"sections":[{"id":"perfumes-hero","type":"hero","enabled":true,"order":10,"props":{"heading":"Signature scents for every mood"},"responsive":{},"position":{}},{"id":"perfumes-grid","type":"product_grid","enabled":true,"order":20,"props":{"heading":"Shop by fragrance family"},"responsive":{},"position":{}}]}', '[{"id":"perfumes-hero","type":"hero","enabled":true,"order":10,"props":{"heading":"Signature scents for every mood"}},{"id":"perfumes-grid","type":"product_grid","enabled":true,"order":20,"props":{"heading":"Shop by fragrance family"}}]', '{"tone":"luxury","primaryColor":"#111827","accentColor":"#f59e0b"}', '{"theme_key":"luxury","layout_key":"editorial","spacing":"comfortable","border_radius":"2rem"}', '{"recommendedPrompts":["Adapt fragrance copy by scent family","Suggest premium gifting blocks"]}', '{"desktop":"Full editorial preview","tablet":"Collection cards","mobile":"Stacked scent finder"}'),
  ('watches-heritage', 'watches-heritage', 'Watches Heritage', 'Trust-led watch storefront for timepieces, materials, and collections.', 'watches', 'watches', 'physical', 'linear-gradient(135deg,#f8fafc,#334155 52%,#020617)', '{"headline":"Timepieces with modern precision","eyebrow":"Heritage collection"}', '[{"title":"Highlight craftsmanship"},{"title":"Compare collections"}]', '[{"title":"Strap Upgrade","code":"STRAP"}]', '{"ctaText":"Explore the collection"}', 'watches-heritage', 'watches', 'Watch template with craftsmanship, collections, and comparison-ready sections.', '{"devices":["desktop","tablet","mobile"]}', '{"version":1,"sections":[{"id":"watches-hero","type":"hero","enabled":true,"order":10,"props":{"heading":"Timepieces with modern precision"},"responsive":{},"position":{}},{"id":"watches-featured","type":"featured_products","enabled":true,"order":20,"props":{"heading":"Featured watches"},"responsive":{},"position":{}}]}', '[{"id":"watches-hero","type":"hero","enabled":true,"order":10,"props":{"heading":"Timepieces with modern precision"}},{"id":"watches-featured","type":"featured_products","enabled":true,"order":20,"props":{"heading":"Featured watches"}}]', '{"tone":"heritage","primaryColor":"#020617","accentColor":"#94a3b8"}', '{"theme_key":"heritage","layout_key":"collection","spacing":"comfortable","border_radius":"1.5rem"}', '{"recommendedPrompts":["Adapt watch benefits by material","Suggest trust badges"]}', '{"desktop":"Collection showcase","tablet":"Feature cards","mobile":"Product-first stack"}'),
  ('pets-happy-care', 'pets-happy-care', 'Pets Happy Care', 'Friendly pet storefront for care routines, bundles, and recommendations.', 'pets', 'pets', 'physical', 'linear-gradient(135deg,#ecfeff,#14b8a6 52%,#134e4a)', '{"headline":"Happy care for every pet at home","eyebrow":"Pet care picks"}', '[{"title":"Shop by pet need"},{"title":"Bundle daily essentials"}]', '[{"title":"New Pet Kit","code":"PAWS"}]', '{"ctaText":"Shop pet favorites"}', 'pets-happy-care', 'pets', 'Pet template with friendly recommendations and bundled care sections.', '{"devices":["desktop","tablet","mobile"]}', '{"version":1,"sections":[{"id":"pets-hero","type":"hero","enabled":true,"order":10,"props":{"heading":"Happy care for every pet at home"},"responsive":{},"position":{}},{"id":"pets-grid","type":"product_grid","enabled":true,"order":20,"props":{"heading":"Daily care essentials"},"responsive":{},"position":{}}]}', '[{"id":"pets-hero","type":"hero","enabled":true,"order":10,"props":{"heading":"Happy care for every pet at home"}},{"id":"pets-grid","type":"product_grid","enabled":true,"order":20,"props":{"heading":"Daily care essentials"}}]', '{"tone":"friendly","primaryColor":"#134e4a","accentColor":"#14b8a6"}', '{"theme_key":"friendly","layout_key":"catalog","spacing":"spacious","border_radius":"2rem"}', '{"recommendedPrompts":["Recommend products by pet type","Adapt friendly care copy"]}', '{"desktop":"Care categories","tablet":"Bundle cards","mobile":"Quick picks"}'),
  ('cafe-local-roast', 'cafe-local-roast', 'Cafe Local Roast', 'Cafe storefront for drinks, pastries, loyalty offers, and ambience.', 'cafes', 'cafes', 'physical', 'linear-gradient(135deg,#fef3c7,#92400e 52%,#1c1917)', '{"headline":"Fresh coffee, warm pastries, local rituals","eyebrow":"Cafe menu"}', '[{"title":"Feature seasonal drinks"},{"title":"Promote loyalty offers"}]', '[{"title":"Morning Combo","code":"LATTE"}]', '{"ctaText":"See today menu"}', 'cafe-local-roast', 'cafes', 'Cafe template with menu highlights, loyalty offers, and local ambience.', '{"devices":["desktop","tablet","mobile"]}', '{"version":1,"sections":[{"id":"cafe-hero","type":"hero","enabled":true,"order":10,"props":{"heading":"Fresh coffee, warm pastries, local rituals"},"responsive":{},"position":{}},{"id":"cafe-menu","type":"featured_products","enabled":true,"order":20,"props":{"heading":"Today favorites"},"responsive":{},"position":{}}]}', '[{"id":"cafe-hero","type":"hero","enabled":true,"order":10,"props":{"heading":"Fresh coffee, warm pastries, local rituals"}},{"id":"cafe-menu","type":"featured_products","enabled":true,"order":20,"props":{"heading":"Today favorites"}}]', '{"tone":"warm","primaryColor":"#1c1917","accentColor":"#d97706"}', '{"theme_key":"warm","layout_key":"menu","spacing":"comfortable","border_radius":"1.75rem"}', '{"recommendedPrompts":["Adapt menu copy by season","Suggest loyalty blocks"]}', '{"desktop":"Menu board","tablet":"Drink cards","mobile":"Order-first stack"}'),
  ('gadgets-launch-pad', 'gadgets-launch-pad', 'Gadgets Launch Pad', 'Launch-focused gadget storefront for smart bundles and comparison sections.', 'gadgets', 'gadgets', 'physical', 'linear-gradient(135deg,#eff6ff,#2563eb 50%,#020617)', '{"headline":"Smart gadgets for faster everyday living","eyebrow":"New tech picks"}', '[{"title":"Compare features quickly"},{"title":"Bundle smart accessories"}]', '[{"title":"Launch Bundle","code":"SMART"}]', '{"ctaText":"Browse new gadgets"}', 'gadgets-launch-pad', 'gadgets', 'Gadget template with launch offers, bundles, and comparison-ready sections.', '{"devices":["desktop","tablet","mobile"]}', '{"version":1,"sections":[{"id":"gadgets-hero","type":"hero","enabled":true,"order":10,"props":{"heading":"Smart gadgets for faster everyday living"},"responsive":{},"position":{}},{"id":"gadgets-grid","type":"product_grid","enabled":true,"order":20,"props":{"heading":"Smart bundles"},"responsive":{},"position":{}}]}', '[{"id":"gadgets-hero","type":"hero","enabled":true,"order":10,"props":{"heading":"Smart gadgets for faster everyday living"}},{"id":"gadgets-grid","type":"product_grid","enabled":true,"order":20,"props":{"heading":"Smart bundles"}}]', '{"tone":"bold","primaryColor":"#020617","accentColor":"#2563eb"}', '{"theme_key":"bold","layout_key":"launch","spacing":"compact","border_radius":"1.25rem"}', '{"recommendedPrompts":["Improve feature comparisons","Suggest launch bundle sections"]}', '{"desktop":"Feature comparison","tablet":"Bundle preview","mobile":"Deal stack"}')
on conflict (id) do update set
  template_key = excluded.template_key,
  name = excluded.name,
  description = excluded.description,
  category_key = excluded.category_key,
  protected_category_key = excluded.protected_category_key,
  template_kind = excluded.template_kind,
  preview_gradient = excluded.preview_gradient,
  homepage_text = excluded.homepage_text,
  demo_sections = excluded.demo_sections,
  demo_offers = excluded.demo_offers,
  default_customization = excluded.default_customization,
  template_slug = excluded.template_slug,
  niche_category = excluded.niche_category,
  preview_summary = excluded.preview_summary,
  preview_config = excluded.preview_config,
  layout_schema = excluded.layout_schema,
  sections_schema = excluded.sections_schema,
  branding_config = excluded.branding_config,
  theme_config = excluded.theme_config,
  ai_customization_config = excluded.ai_customization_config,
  responsive_preview_config = excluded.responsive_preview_config;

insert into public.store_templates (
  id,
  template_key,
  name,
  description,
  category_key,
  protected_category_key,
  template_kind,
  preview_gradient,
  homepage_text,
  demo_sections,
  demo_offers,
  default_customization,
  template_slug,
  niche_category,
  preview_summary,
  preview_config,
  layout_schema,
  sections_schema,
  branding_config,
  theme_config,
  ai_customization_config,
  responsive_preview_config
)
values
  ('gym-performance-club', 'gym-performance-club', 'Gym Performance Club', 'Gym storefront for memberships, training gear, classes, and bundles.', 'gym', 'gym', 'physical', 'linear-gradient(135deg,#ecfccb,#16a34a 52%,#052e16)', '{"headline":"Train stronger with gear and programs built for progress","eyebrow":"Gym essentials"}', '[{"title":"Promote classes and training gear"},{"title":"Bundle supplements and equipment"}]', '[{"title":"Starter Training Pack","code":"TRAIN"}]', '{"ctaText":"Build your training plan"}', 'gym-performance-club', 'gym', 'Gym template with classes, training bundles, and performance sections.', '{"devices":["desktop","tablet","mobile"]}', '{"version":1,"sections":[{"id":"gym-hero","type":"hero","enabled":true,"order":10,"props":{"heading":"Train stronger with gear and programs built for progress"},"responsive":{},"position":{}},{"id":"gym-grid","type":"product_grid","enabled":true,"order":20,"props":{"heading":"Performance essentials"},"responsive":{},"position":{}}]}', '[{"id":"gym-hero","type":"hero","enabled":true,"order":10,"props":{"heading":"Train stronger with gear and programs built for progress"}},{"id":"gym-grid","type":"product_grid","enabled":true,"order":20,"props":{"heading":"Performance essentials"}}]', '{"tone":"performance","primaryColor":"#052e16","accentColor":"#16a34a"}', '{"theme_key":"performance","layout_key":"program","spacing":"compact","border_radius":"1.5rem"}', '{"recommendedPrompts":["Recommend products by fitness goal","Adapt workout copy"]}', '{"desktop":"Program sections","tablet":"Class cards","mobile":"Join-first stack"}'),
  ('restaurant-chef-menu', 'restaurant-chef-menu', 'Restaurant Chef Menu', 'Restaurant storefront for menus, chef specials, reservations, and delivery highlights.', 'restaurants', 'restaurants', 'physical', 'linear-gradient(135deg,#fff7ed,#dc2626 52%,#431407)', '{"headline":"Chef specials, local flavor, and easy ordering","eyebrow":"Restaurant menu"}', '[{"title":"Feature specials and reservations"},{"title":"Highlight delivery offers"}]', '[{"title":"Chef Special Combo","code":"CHEF"}]', '{"ctaText":"Explore the menu"}', 'restaurant-chef-menu', 'restaurants', 'Restaurant template with menus, specials, reservations, and delivery CTAs.', '{"devices":["desktop","tablet","mobile"]}', '{"version":1,"sections":[{"id":"restaurant-hero","type":"hero","enabled":true,"order":10,"props":{"heading":"Chef specials, local flavor, and easy ordering"},"responsive":{},"position":{}},{"id":"restaurant-menu","type":"featured_products","enabled":true,"order":20,"props":{"heading":"Chef favorites"},"responsive":{},"position":{}}]}', '[{"id":"restaurant-hero","type":"hero","enabled":true,"order":10,"props":{"heading":"Chef specials, local flavor, and easy ordering"}},{"id":"restaurant-menu","type":"featured_products","enabled":true,"order":20,"props":{"heading":"Chef favorites"}}]', '{"tone":"appetizing","primaryColor":"#431407","accentColor":"#dc2626"}', '{"theme_key":"appetizing","layout_key":"menu","spacing":"comfortable","border_radius":"1.75rem"}', '{"recommendedPrompts":["Adapt menu copy by cuisine","Suggest reservation CTAs"]}', '{"desktop":"Menu showcase","tablet":"Specials cards","mobile":"Order-first stack"}')
on conflict (id) do update set
  template_key = excluded.template_key,
  name = excluded.name,
  description = excluded.description,
  category_key = excluded.category_key,
  protected_category_key = excluded.protected_category_key,
  template_kind = excluded.template_kind,
  preview_gradient = excluded.preview_gradient,
  homepage_text = excluded.homepage_text,
  demo_sections = excluded.demo_sections,
  demo_offers = excluded.demo_offers,
  default_customization = excluded.default_customization,
  template_slug = excluded.template_slug,
  niche_category = excluded.niche_category,
  preview_summary = excluded.preview_summary,
  preview_config = excluded.preview_config,
  layout_schema = excluded.layout_schema,
  sections_schema = excluded.sections_schema,
  branding_config = excluded.branding_config,
  theme_config = excluded.theme_config,
  ai_customization_config = excluded.ai_customization_config,
  responsive_preview_config = excluded.responsive_preview_config;

insert into public.template_sections (
  template_id,
  section_key,
  section_type,
  section_order,
  section_schema,
  ai_customization_hints
)
select
  st.id,
  section.section_key,
  section.section_type,
  section.section_order,
  section.section_schema,
  section.ai_customization_hints
from public.store_templates st
cross join lateral (
  values
    ('hero', 'hero', 10, jsonb_build_object('type', 'hero', 'props', st.homepage_text), jsonb_build_object('ai_ready', true)),
    ('catalog', 'product_grid', 20, jsonb_build_object('type', 'product_grid', 'props', jsonb_build_object('heading', 'Featured products')), jsonb_build_object('ai_ready', true)),
    ('story', 'rich_text', 30, jsonb_build_object('type', 'rich_text', 'props', jsonb_build_object('heading', 'Brand story')), jsonb_build_object('ai_ready', true))
) as section(section_key, section_type, section_order, section_schema, ai_customization_hints)
where st.niche_category in ('fashion', 'beauty', 'perfumes', 'electronics', 'watches', 'furniture', 'gym', 'pets', 'restaurants', 'cafes', 'gadgets', 'food', 'fitness')
on conflict (template_id, section_key) do update set
  section_type = excluded.section_type,
  section_order = excluded.section_order,
  section_schema = excluded.section_schema,
  ai_customization_hints = excluded.ai_customization_hints;

insert into public.template_theme_configs (
  template_id,
  theme_key,
  layout_key,
  typography,
  color_palette,
  spacing,
  border_radius,
  style_config,
  ai_branding_hints
)
select
  id,
  coalesce(theme_config->>'theme_key', 'modern'),
  coalesce(theme_config->>'layout_key', 'classic'),
  jsonb_build_object('heading', 'Inter', 'body', 'Inter'),
  jsonb_build_object(
    'primary', coalesce(branding_config->>'primaryColor', '#0f172a'),
    'accent', coalesce(branding_config->>'accentColor', '#2563eb'),
    'background', '#ffffff',
    'surface', '#f8fafc',
    'text', '#0f172a'
  ),
  coalesce(theme_config->>'spacing', 'comfortable'),
  coalesce(theme_config->>'border_radius', '2rem'),
  theme_config,
  ai_customization_config
from public.store_templates
where niche_category is not null
on conflict (template_id) do update set
  theme_key = excluded.theme_key,
  layout_key = excluded.layout_key,
  typography = excluded.typography,
  color_palette = excluded.color_palette,
  spacing = excluded.spacing,
  border_radius = excluded.border_radius,
  style_config = excluded.style_config,
  ai_branding_hints = excluded.ai_branding_hints;

insert into public.template_preview_assets (
  template_id,
  asset_key,
  asset_type,
  alt_text,
  metadata
)
select
  id,
  'hero-preview',
  'gradient',
  name || ' preview placeholder',
  jsonb_build_object('gradient', preview_gradient, 'responsive', responsive_preview_config)
from public.store_templates
where niche_category is not null
on conflict (template_id, asset_key) do update set
  asset_type = excluded.asset_type,
  alt_text = excluded.alt_text,
  metadata = excluded.metadata;

