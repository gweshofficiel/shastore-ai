-- Template library and Studio foundation.
-- This migration intentionally does not touch platform billing, auth core,
-- buyer checkout, storefront rendering, reseller public showcase pages,
-- admin billing, shipping, or payment systems.

create table if not exists public.template_categories (
  category_key text primary key,
  name text not null,
  description text,
  locked_category_mapping text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (category_key = locked_category_mapping),
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
      'marketplace'
    )
  )
);

create table if not exists public.store_templates (
  id uuid primary key default gen_random_uuid(),
  template_key text not null unique,
  name text not null,
  description text,
  category_key text not null references public.template_categories(category_key),
  protected_category_key text not null references public.template_categories(category_key),
  template_kind text not null default 'physical' check (template_kind in ('physical', 'digital', 'marketplace')),
  owner_user_id uuid references auth.users(id) on delete cascade,
  source_template_id uuid references public.store_templates(id) on delete set null,
  is_system_template boolean not null default true,
  preview_gradient text,
  homepage_text jsonb not null default '{}'::jsonb,
  demo_sections jsonb not null default '[]'::jsonb,
  demo_offers jsonb not null default '[]'::jsonb,
  default_customization jsonb not null default '{}'::jsonb,
  allowed_publish_targets text[] not null default array['seller_store', 'reseller_showcase', 'marketplace_listing'],
  category_validation_placeholder text,
  wrong_category_publish_placeholder text,
  status text not null default 'published' check (status in ('draft', 'published', 'unpublished')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (category_key = protected_category_key)
);

create table if not exists public.template_customizations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  template_id uuid not null references public.store_templates(id) on delete cascade,
  duplicate_of_template_id uuid references public.store_templates(id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'published', 'unpublished')),
  customization jsonb not null default '{}'::jsonb,
  featured_products jsonb not null default '[]'::jsonb,
  contact_info jsonb not null default '{}'::jsonb,
  social_links jsonb not null default '{}'::jsonb,
  seo_placeholders jsonb not null default '{}'::jsonb,
  publish_target text not null default 'seller_store' check (
    publish_target in ('seller_store', 'reseller_showcase', 'marketplace_listing')
  ),
  linked_reseller_showcase_item_id uuid,
  linked_marketplace_listing_id uuid,
  restore_defaults_requested boolean not null default false,
  preview_token text,
  published_at timestamptz,
  unpublished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, template_id)
);

create table if not exists public.template_demo_products (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.store_templates(id) on delete cascade,
  product_type text not null check (product_type in ('physical', 'digital', 'marketplace')),
  name text not null,
  demo_price numeric(12, 2),
  price_label text,
  category text not null,
  short_description text,
  image_placeholder text,
  stock_placeholder text,
  featured boolean not null default false,
  download_type_placeholder text,
  file_delivery_placeholder text,
  license_placeholder text,
  preview_image_placeholder text,
  vendor_placeholder text,
  commission_placeholder text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.template_usage_limits (
  id uuid primary key default gen_random_uuid(),
  plan_key text not null,
  category_key text not null references public.template_categories(category_key),
  allowed_template_categories text[] not null default '{}'::text[],
  monthly_publish_limit integer,
  sales_limit_per_category numeric(12, 2),
  automatic_listing_disable_placeholder boolean not null default false,
  usage_tracking_placeholder jsonb not null default '{}'::jsonb,
  enforcement_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plan_key, category_key)
);

create index if not exists store_templates_category_key_idx
  on public.store_templates(category_key);

create index if not exists store_templates_owner_user_id_idx
  on public.store_templates(owner_user_id);

create index if not exists template_customizations_user_id_idx
  on public.template_customizations(user_id);

create index if not exists template_customizations_template_id_idx
  on public.template_customizations(template_id);

create index if not exists template_demo_products_template_id_idx
  on public.template_demo_products(template_id);

create index if not exists template_usage_limits_category_key_idx
  on public.template_usage_limits(category_key);

alter table public.template_categories enable row level security;
alter table public.store_templates enable row level security;
alter table public.template_customizations enable row level security;
alter table public.template_demo_products enable row level security;
alter table public.template_usage_limits enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'template_categories'
      and policyname = 'Authenticated users can read template categories'
  ) then
    create policy "Authenticated users can read template categories"
      on public.template_categories for select
      using (auth.uid() is not null);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'store_templates'
      and policyname = 'Authenticated users can read system templates'
  ) then
    create policy "Authenticated users can read system templates"
      on public.store_templates for select
      using (auth.uid() is not null and (is_system_template = true or owner_user_id = auth.uid()));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'store_templates'
      and policyname = 'Users manage own duplicated templates'
  ) then
    create policy "Users manage own duplicated templates"
      on public.store_templates for all
      using (owner_user_id = auth.uid())
      with check (owner_user_id = auth.uid() and is_system_template = false);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'template_customizations'
      and policyname = 'Users manage own template customizations'
  ) then
    create policy "Users manage own template customizations"
      on public.template_customizations for all
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'template_demo_products'
      and policyname = 'Authenticated users can read template demo products'
  ) then
    create policy "Authenticated users can read template demo products"
      on public.template_demo_products for select
      using (auth.uid() is not null);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'template_usage_limits'
      and policyname = 'Authenticated users can read template usage limits'
  ) then
    create policy "Authenticated users can read template usage limits"
      on public.template_usage_limits for select
      using (auth.uid() is not null);
  end if;
end $$;

create or replace function public.set_template_studio_updated_at()
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
  if not exists (select 1 from pg_trigger where tgname = 'template_categories_updated_at') then
    create trigger template_categories_updated_at
      before update on public.template_categories
      for each row execute function public.set_template_studio_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'store_templates_updated_at') then
    create trigger store_templates_updated_at
      before update on public.store_templates
      for each row execute function public.set_template_studio_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'template_customizations_updated_at') then
    create trigger template_customizations_updated_at
      before update on public.template_customizations
      for each row execute function public.set_template_studio_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'template_demo_products_updated_at') then
    create trigger template_demo_products_updated_at
      before update on public.template_demo_products
      for each row execute function public.set_template_studio_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'template_usage_limits_updated_at') then
    create trigger template_usage_limits_updated_at
      before update on public.template_usage_limits
      for each row execute function public.set_template_studio_updated_at();
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
  ('fashion', 'Fashion Store', 'Boutique apparel and seasonal edits.', 'fashion', 10),
  ('jewelry', 'Jewelry Store', 'Fine jewelry and gift-focused product pages.', 'jewelry', 20),
  ('electronics', 'Electronics Store', 'Gadgets, accessories, specs, and bundles.', 'electronics', 30),
  ('beauty', 'Beauty & Cosmetics Store', 'Skincare, makeup, routines, and social proof.', 'beauty', 40),
  ('food', 'Restaurant / Food Store', 'Menus, bundles, catering, and delivery notes.', 'food', 50),
  ('furniture', 'Furniture Store', 'Room collections, material notes, and delivery confidence.', 'furniture', 60),
  ('fitness', 'Fitness Store', 'Training gear, supplements, and performance bundles.', 'fitness', 70),
  ('kids', 'Kids / Baby Store', 'Baby essentials, toys, gifting, and safety notes.', 'kids', 80),
  ('digital', 'Digital Products Store', 'Ebooks, courses, templates, prompt packs, and licenses.', 'digital', 90),
  ('marketplace', 'Multi-Category Marketplace', 'Vendor shelves, featured sellers, and commissions.', 'marketplace', 100)
on conflict (category_key) do update set
  name = excluded.name,
  description = excluded.description,
  locked_category_mapping = excluded.locked_category_mapping,
  sort_order = excluded.sort_order;

insert into public.store_templates (
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
  category_validation_placeholder,
  wrong_category_publish_placeholder
)
values
  ('fashion-atelier', 'Fashion Atelier', 'Premium boutique layout with seasonal outfits and apparel demo products.', 'fashion', 'fashion', 'physical', 'linear-gradient(135deg,#fff7ed,#111827 58%,#f97316)', '{"headline":"Curated looks for every polished moment"}', '[{"title":"Style the full outfit in one click"}]', '[{"title":"Launch Week Wardrobe","code":"STYLE40"}]', '{"ctaText":"Shop the latest edit"}', 'Validate fashion category before publish.', 'Block fashion templates from electronics or other mismatched categories.'),
  ('jewelry-luxe', 'Jewelry Luxe', 'Trust-heavy jewelry storefront for rings, necklaces, and gifting.', 'jewelry', 'jewelry', 'physical', 'linear-gradient(135deg,#fef3c7,#78350f 56%,#fbbf24)', '{"headline":"Fine pieces made for everyday rituals"}', '[{"title":"Show quality before checkout"}]', '[{"title":"Complimentary Gift Box","code":"GIFTBOX"}]', '{"ctaText":"Explore the gift edit"}', 'Validate jewelry category before publish.', 'Block jewelry templates from electronics or other mismatched categories.'),
  ('electronics-hub', 'Electronics Hub', 'Spec-focused electronics template for gadgets and smart bundles.', 'electronics', 'electronics', 'physical', 'linear-gradient(135deg,#020617,#2563eb 55%,#67e8f9)', '{"headline":"Smart gear for faster everyday work"}', '[{"title":"Make comparisons simple"}]', '[{"title":"Creator Setup Bundle","code":"CREATOR15"}]', '{"ctaText":"Browse smart deals"}', 'Validate electronics category before publish.', 'Block electronics templates from jewelry or other mismatched categories.'),
  ('beauty-glow-lab', 'Beauty Glow Lab', 'Cosmetics template for routines, ingredient callouts, and bundles.', 'beauty', 'beauty', 'physical', 'linear-gradient(135deg,#fff1f2,#fb7185 54%,#7f1d1d)', '{"headline":"Daily glow routines customers can trust"}', '[{"title":"Guide shoppers by skin goal"}]', '[{"title":"Glow Starter Kit","code":"GLOWKIT"}]', '{"ctaText":"Build your routine"}', 'Validate beauty category before publish.', 'Block beauty templates from other mismatched categories.'),
  ('food-market', 'Food Market', 'Restaurant and food ordering template for menus and delivery offers.', 'food', 'food', 'physical', 'linear-gradient(135deg,#fff7ed,#ea580c 52%,#431407)', '{"headline":"Fresh meals, fast ordering, local flavor"}', '[{"title":"Highlight dishes with appetite-first cards"}]', '[{"title":"Lunch Rush Deal","code":"LUNCHDRINK"}]', '{"ctaText":"Order today favorites"}', 'Validate food category before publish.', 'Block food templates from other mismatched categories.'),
  ('furniture-studio', 'Furniture Studio', 'Home store template for room collections and material notes.', 'furniture', 'furniture', 'physical', 'linear-gradient(135deg,#f5f5f4,#78716c 52%,#1c1917)', '{"headline":"Design calm rooms with statement pieces"}', '[{"title":"Sell by space, not only by product"}]', '[{"title":"Room Refresh","code":"ROOM75"}]', '{"ctaText":"Explore room collections"}', 'Validate furniture category before publish.', 'Block furniture templates from other mismatched categories.'),
  ('fitness-performance', 'Fitness Performance', 'Training gear and supplement template with bundle sections.', 'fitness', 'fitness', 'physical', 'linear-gradient(135deg,#ecfccb,#16a34a 52%,#052e16)', '{"headline":"Gear up for stronger training days"}', '[{"title":"Bundle by customer goal"}]', '[{"title":"Starter Stack","code":"STACK20"}]', '{"ctaText":"Shop training essentials"}', 'Validate fitness category before publish.', 'Block fitness templates from other mismatched categories.'),
  ('baby-bloom', 'Baby Bloom', 'Kids and baby template with essentials, toys, gifting, and safety notes.', 'kids', 'kids', 'physical', 'linear-gradient(135deg,#eff6ff,#f9a8d4 52%,#7c3aed)', '{"headline":"Soft essentials for little everyday moments"}', '[{"title":"Help parents choose quickly"}]', '[{"title":"New Parent Bundle","code":"BABY15"}]', '{"ctaText":"Shop baby favorites"}', 'Validate kids category before publish.', 'Block kids templates from other mismatched categories.'),
  ('digital-creator-kit', 'Digital Creator Kit', 'Digital storefront for ebooks, templates, prompt packs, and creator resources.', 'digital', 'digital', 'digital', 'linear-gradient(135deg,#eef2ff,#4f46e5 52%,#111827)', '{"headline":"Download-ready tools for faster content creation"}', '[{"title":"Set expectations before purchase"}]', '[{"title":"Creator Launch Bundle","code":"CREATORBUNDLE"}]', '{"ctaText":"Browse instant downloads"}', 'Validate digital category before publish.', 'Block digital templates from physical categories.'),
  ('digital-course-academy', 'Digital Course Academy', 'Course-first digital template for lessons, workbooks, and gated delivery.', 'digital', 'digital', 'digital', 'linear-gradient(135deg,#ecfeff,#0891b2 52%,#164e63)', '{"headline":"Package your expertise into a premium digital academy"}', '[{"title":"Preview learning outcomes clearly"}]', '[{"title":"Academy Starter","code":"ACADEMY"}]', '{"ctaText":"Preview the curriculum"}', 'Validate digital category before publish.', 'Block digital templates from physical categories.'),
  ('marketplace-city-bazaar', 'City Bazaar Marketplace', 'Multi-vendor marketplace template for local sellers and commission placeholders.', 'marketplace', 'marketplace', 'marketplace', 'linear-gradient(135deg,#f8fafc,#0f172a 52%,#22c55e)', '{"headline":"One marketplace for the city best independent sellers"}', '[{"title":"Feature sellers as the hero product"}]', '[{"title":"Marketplace Launch Week","code":"SELLERLAUNCH"}]', '{"ctaText":"Explore featured sellers"}', 'Validate marketplace category before publish.', 'Block marketplace templates from single-store categories.'),
  ('marketplace-mega-mall', 'Mega Mall Marketplace', 'Broad marketplace layout for many categories, vendor discovery, and promotions.', 'marketplace', 'marketplace', 'marketplace', 'linear-gradient(135deg,#fefce8,#ca8a04 48%,#1f2937)', '{"headline":"A multi-category mall ready for vendor growth"}', '[{"title":"Give every category a clear shelf"}]', '[{"title":"Mall Opening Deal","code":"MEGAMALL"}]', '{"ctaText":"Browse marketplace deals"}', 'Validate marketplace category before publish.', 'Block marketplace templates from single-store categories.')
on conflict (template_key) do update set
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
  category_validation_placeholder = excluded.category_validation_placeholder,
  wrong_category_publish_placeholder = excluded.wrong_category_publish_placeholder;

insert into public.template_demo_products (
  template_id,
  product_type,
  name,
  demo_price,
  price_label,
  category,
  short_description,
  image_placeholder,
  stock_placeholder,
  featured,
  download_type_placeholder,
  file_delivery_placeholder,
  license_placeholder,
  preview_image_placeholder,
  vendor_placeholder,
  commission_placeholder
)
select
  st.id,
  demo.product_type,
  demo.name,
  demo.demo_price,
  demo.price_label,
  demo.category,
  demo.short_description,
  demo.image_placeholder,
  demo.stock_placeholder,
  demo.featured,
  demo.download_type_placeholder,
  demo.file_delivery_placeholder,
  demo.license_placeholder,
  demo.preview_image_placeholder,
  demo.vendor_placeholder,
  demo.commission_placeholder
from public.store_templates st
join (
  values
    ('fashion-atelier', 'physical', 'Linen Wrap Midi Dress', 89.00, '$89', 'Dresses', 'Breathable linen blend with a flattering waist tie.', 'fashion-dress-placeholder.jpg', '42 units available', true, null, null, null, null, null, null),
    ('jewelry-luxe', 'physical', 'Gold Vermeil Signet Ring', 149.00, '$149', 'Rings', 'Polished vermeil ring with keepsake-ready packaging.', 'jewelry-ring-placeholder.jpg', '24 units available', true, null, null, null, null, null, null),
    ('electronics-hub', 'physical', 'MagSafe Desk Charger Pro', 59.00, '$59', 'Chargers', 'Three-in-one magnetic charging dock.', 'electronics-charger-placeholder.jpg', '75 units available', true, null, null, null, null, null, null),
    ('beauty-glow-lab', 'physical', 'Vitamin C Morning Serum', 42.00, '$42', 'Skincare', 'Brightening serum with daily antioxidant support.', 'beauty-serum-placeholder.jpg', '88 units available', true, null, null, null, null, null, null),
    ('food-market', 'physical', 'Harissa Chicken Bowl', 14.00, '$14', 'Chef Specials', 'Grilled chicken, saffron rice, salad, and harissa sauce.', 'food-bowl-placeholder.jpg', 'Prepared fresh daily', true, null, null, null, null, null, null),
    ('furniture-studio', 'physical', 'Noura Boucle Lounge Chair', 420.00, '$420', 'Living Room', 'Curved accent chair with textured boucle fabric.', 'furniture-chair-placeholder.jpg', '12 units available', true, null, null, null, null, null, null),
    ('fitness-performance', 'physical', 'Adjustable Resistance Band Set', 32.00, '$32', 'Equipment', 'Five-band training kit with handles and travel pouch.', 'fitness-bands-placeholder.jpg', '110 units available', true, null, null, null, null, null, null),
    ('baby-bloom', 'physical', 'Organic Cotton Swaddle Trio', 38.00, '$38', 'Newborn', 'Three breathable muslin swaddles in soft neutral prints.', 'baby-swaddle-placeholder.jpg', '82 units available', true, null, null, null, null, null, null),
    ('digital-creator-kit', 'digital', 'AI Product Copy Prompt Pack', 24.00, '$24', 'Prompt Packs', 'Prompt library for product names, benefits, emails, ads, and FAQs.', null, null, true, 'PDF + Google Doc prompt pack', 'Secure download link placeholder', 'Personal and client-use license placeholder', 'digital-prompts-preview.jpg', null, null),
    ('digital-course-academy', 'digital', 'Store Launch Masterclass', 149.00, '$149', 'Courses', 'Six-module course for niche choice, copy, and launch traffic.', null, null, true, 'Course portal access placeholder', 'Invite email after publish placeholder', 'Single-student license placeholder', 'academy-course-preview.jpg', null, null),
    ('marketplace-city-bazaar', 'marketplace', 'Vendor Spotlight Bundle', 75.00, '$75', 'Fashion', 'Curated bundle placeholder from a featured fashion vendor.', 'marketplace-fashion-placeholder.jpg', null, true, null, null, null, null, 'Lina Style Studio', '12% marketplace commission placeholder'),
    ('marketplace-mega-mall', 'marketplace', 'Smart Home Starter Kit', 119.00, '$119', 'Electronics', 'Demo marketplace product from an electronics vendor.', 'mall-electronics-placeholder.jpg', null, true, null, null, null, null, 'Tech Yard', '11% marketplace commission placeholder')
) as demo(
  template_key,
  product_type,
  name,
  demo_price,
  price_label,
  category,
  short_description,
  image_placeholder,
  stock_placeholder,
  featured,
  download_type_placeholder,
  file_delivery_placeholder,
  license_placeholder,
  preview_image_placeholder,
  vendor_placeholder,
  commission_placeholder
) on demo.template_key = st.template_key
where not exists (
  select 1
  from public.template_demo_products existing
  where existing.template_id = st.id
    and existing.name = demo.name
);

insert into public.template_usage_limits (
  plan_key,
  category_key,
  allowed_template_categories,
  monthly_publish_limit,
  sales_limit_per_category,
  automatic_listing_disable_placeholder,
  usage_tracking_placeholder,
  enforcement_enabled
)
select
  plan_key,
  category_key,
  allowed_template_categories,
  monthly_publish_limit,
  sales_limit_per_category,
  automatic_listing_disable_placeholder,
  usage_tracking_placeholder,
  false
from (
  values
    ('starter', 'fashion', array['fashion','jewelry','beauty','food','kids'], 3, 2500.00, true, '{"tracked":"placeholder"}'::jsonb),
    ('starter', 'digital', array['digital'], 2, 1500.00, true, '{"tracked":"placeholder"}'::jsonb),
    ('growth', 'marketplace', array['fashion','jewelry','electronics','beauty','food','furniture','fitness','kids','digital','marketplace'], 10, 10000.00, true, '{"tracked":"placeholder"}'::jsonb),
    ('reseller_pro', 'marketplace', array['fashion','jewelry','electronics','beauty','food','furniture','fitness','kids','digital','marketplace'], 50, 50000.00, true, '{"tracked":"placeholder"}'::jsonb)
) as limits(
  plan_key,
  category_key,
  allowed_template_categories,
  monthly_publish_limit,
  sales_limit_per_category,
  automatic_listing_disable_placeholder,
  usage_tracking_placeholder
)
on conflict (plan_key, category_key) do update set
  allowed_template_categories = excluded.allowed_template_categories,
  monthly_publish_limit = excluded.monthly_publish_limit,
  sales_limit_per_category = excluded.sales_limit_per_category,
  automatic_listing_disable_placeholder = excluded.automatic_listing_disable_placeholder,
  usage_tracking_placeholder = excluded.usage_tracking_placeholder,
  enforcement_enabled = false;
