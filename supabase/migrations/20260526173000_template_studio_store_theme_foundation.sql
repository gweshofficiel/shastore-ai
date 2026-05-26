-- Template Studio + isolated store theme foundation.
-- Additive only: no store data is dropped or reset.

alter table if exists public.stores
  add column if not exists template_id text,
  add column if not exists theme_color text,
  add column if not exists font_style text,
  add column if not exists layout_style text,
  add column if not exists theme_settings jsonb not null default '{}'::jsonb;

update public.stores
set
  template_id = coalesce(nullif(template_id, ''), 'general-starter'),
  theme_color = coalesce(nullif(theme_color, ''), brand_color, '#0f172a'),
  font_style = coalesce(nullif(font_style, ''), 'modern'),
  layout_style = coalesce(nullif(layout_style, ''), 'classic'),
  theme_settings = coalesce(theme_settings, '{}'::jsonb)
where template_id is null
  or theme_color is null
  or font_style is null
  or layout_style is null
  or theme_settings is null;

create table if not exists public.store_templates (
  id text primary key,
  name text not null,
  slug text unique,
  category text not null default 'general',
  preview_image text,
  template_type text not null default 'store',
  default_theme_settings jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table if exists public.store_templates
  add column if not exists slug text,
  add column if not exists description text,
  add column if not exists category text not null default 'general',
  add column if not exists category_key text,
  add column if not exists preview_image text,
  add column if not exists preview_gradient text,
  add column if not exists preview_summary text,
  add column if not exists preview_config jsonb not null default '{}'::jsonb,
  add column if not exists template_key text,
  add column if not exists template_type text not null default 'store',
  add column if not exists template_slug text,
  add column if not exists niche_category text,
  add column if not exists layout_schema jsonb not null default '{"version":1,"sections":[{"id":"starter-hero","type":"hero","enabled":true,"order":10,"props":{"heading":"Starter storefront"},"responsive":{}}]}'::jsonb,
  add column if not exists sections_schema jsonb not null default '[]'::jsonb,
  add column if not exists branding_config jsonb not null default '{}'::jsonb,
  add column if not exists theme_config jsonb not null default '{}'::jsonb,
  add column if not exists default_theme_settings jsonb not null default '{}'::jsonb,
  add column if not exists ai_customization_config jsonb not null default '{}'::jsonb,
  add column if not exists responsive_preview_config jsonb not null default '{}'::jsonb,
  add column if not exists status text not null default 'published',
  add column if not exists is_active boolean not null default true,
  add column if not exists created_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'store_templates'
      and indexname = 'store_templates_slug_unique_idx'
  ) then
    create unique index store_templates_slug_unique_idx
      on public.store_templates(slug)
      where slug is not null;
  end if;
end $$;

create index if not exists store_templates_category_active_idx
  on public.store_templates(category, is_active, created_at desc);

-- Legacy rows: template_key is NOT NULL on existing store_templates tables.
update public.store_templates
set
  template_key = coalesce(nullif(template_key, ''), nullif(slug, ''), nullif(template_slug, ''), id),
  template_slug = coalesce(nullif(template_slug, ''), nullif(slug, ''), template_key, id),
  slug = coalesce(nullif(slug, ''), template_key, template_slug, id)
where template_key is null or btrim(template_key) = '';

insert into public.store_templates (
  id,
  template_key,
  name,
  slug,
  template_slug,
  category,
  category_key,
  niche_category,
  preview_image,
  template_type,
  default_theme_settings,
  is_active
)
values
  (
    'fashion-starter',
    'fashion-starter',
    'Fashion Starter',
    'fashion-starter',
    'fashion-starter',
    'fashion',
    'fashion',
    'fashion',
    null,
    'store',
    '{"themeColor":"#be123c","fontStyle":"editorial","layoutStyle":"lookbook","colorPresets":["rose","slate","cream"],"multilingualReady":true,"aiTemplateReady":true}'::jsonb,
    true
  ),
  (
    'electronics-starter',
    'electronics-starter',
    'Electronics Starter',
    'electronics-starter',
    'electronics-starter',
    'electronics',
    'electronics',
    'electronics',
    null,
    'store',
    '{"themeColor":"#2563eb","fontStyle":"modern","layoutStyle":"spec-grid","colorPresets":["blue","zinc","cyan"],"multilingualReady":true,"aiTemplateReady":true}'::jsonb,
    true
  ),
  (
    'beauty-starter',
    'beauty-starter',
    'Beauty Starter',
    'beauty-starter',
    'beauty-starter',
    'beauty',
    'beauty',
    'beauty',
    null,
    'store',
    '{"themeColor":"#db2777","fontStyle":"soft","layoutStyle":"routine","colorPresets":["pink","white","stone"],"multilingualReady":true,"aiTemplateReady":true}'::jsonb,
    true
  ),
  (
    'perfume-starter',
    'perfume-starter',
    'Perfume Starter',
    'perfume-starter',
    'perfume-starter',
    'perfume',
    'perfume',
    'perfume',
    null,
    'store',
    '{"themeColor":"#7c3aed","fontStyle":"luxury","layoutStyle":"collection","colorPresets":["violet","amber","black"],"multilingualReady":true,"aiTemplateReady":true}'::jsonb,
    true
  ),
  (
    'restaurant-starter',
    'restaurant-starter',
    'Restaurant Starter',
    'restaurant-starter',
    'restaurant-starter',
    'restaurant',
    'restaurant',
    'restaurant',
    null,
    'store',
    '{"themeColor":"#ea580c","fontStyle":"warm","layoutStyle":"menu","colorPresets":["orange","cream","brown"],"multilingualReady":true,"aiTemplateReady":true}'::jsonb,
    true
  ),
  (
    'jewelry-starter',
    'jewelry-starter',
    'Jewelry Starter',
    'jewelry-starter',
    'jewelry-starter',
    'jewelry',
    'jewelry',
    'jewelry',
    null,
    'store',
    '{"themeColor":"#b45309","fontStyle":"luxury","layoutStyle":"gallery","colorPresets":["gold","white","slate"],"multilingualReady":true,"aiTemplateReady":true}'::jsonb,
    true
  ),
  (
    'general-starter',
    'general-starter',
    'General Starter',
    'general-starter',
    'general-starter',
    'general',
    'general',
    'general',
    null,
    'store',
    '{"themeColor":"#0f172a","fontStyle":"modern","layoutStyle":"classic","colorPresets":["slate","blue","white"],"multilingualReady":true,"aiTemplateReady":true}'::jsonb,
    true
  )
on conflict (id) do update
set
  name = excluded.name,
  template_key = coalesce(
    nullif(excluded.template_key, ''),
    nullif(excluded.slug, ''),
    nullif(excluded.template_slug, ''),
    excluded.id
  ),
  slug = coalesce(public.store_templates.slug, excluded.slug, excluded.template_key),
  template_slug = coalesce(
    public.store_templates.template_slug,
    excluded.template_slug,
    excluded.slug,
    excluded.template_key
  ),
  category = excluded.category,
  category_key = coalesce(public.store_templates.category_key, excluded.category_key, excluded.category),
  niche_category = coalesce(public.store_templates.niche_category, excluded.niche_category, excluded.category),
  preview_image = coalesce(public.store_templates.preview_image, excluded.preview_image),
  template_type = excluded.template_type,
  default_theme_settings = public.store_templates.default_theme_settings || excluded.default_theme_settings,
  is_active = true;

update public.store_templates
set
  category_key = coalesce(nullif(category_key, ''), category),
  template_key = coalesce(nullif(template_key, ''), slug, id),
  template_slug = coalesce(nullif(template_slug, ''), slug, id),
  niche_category = coalesce(nullif(niche_category, ''), category),
  preview_summary = coalesce(preview_summary, description, concat(name, ' production-ready store layout.')),
  preview_config = coalesce(preview_config, '{"devices":["desktop","tablet","mobile"]}'::jsonb),
  responsive_preview_config = coalesce(responsive_preview_config, '{"desktop":"Full preview","tablet":"Tablet preview","mobile":"Mobile preview"}'::jsonb),
  branding_config = coalesce(branding_config, '{}'::jsonb) || jsonb_build_object(
    'primaryColor',
    coalesce(default_theme_settings ->> 'themeColor', '#0f172a')
  ),
  theme_config = coalesce(theme_config, '{}'::jsonb) || jsonb_build_object(
    'themeColor',
    coalesce(default_theme_settings ->> 'themeColor', '#0f172a'),
    'fontStyle',
    coalesce(default_theme_settings ->> 'fontStyle', 'modern'),
    'layoutStyle',
    coalesce(default_theme_settings ->> 'layoutStyle', 'classic')
  ),
  layout_schema = case
    when layout_schema is null or layout_schema = '{}'::jsonb then jsonb_build_object(
      'version', 1,
      'sections', jsonb_build_array(jsonb_build_object(
        'id', concat(id, '-hero'),
        'type', 'hero',
        'enabled', true,
        'order', 10,
        'props', jsonb_build_object('heading', name),
        'responsive', '{}'::jsonb
      ))
    )
    else layout_schema
  end,
  status = coalesce(nullif(status, ''), 'published')
where is_active = true;

alter table if exists public.store_theme_settings
  add column if not exists workspace_id uuid,
  add column if not exists template_id text,
  add column if not exists theme_color text,
  add column if not exists font_style text,
  add column if not exists layout_style text,
  add column if not exists theme_settings jsonb not null default '{}'::jsonb;

do $$
begin
  if to_regclass('public.store_theme_settings') is not null
     and to_regclass('public.stores') is not null then
    update public.store_theme_settings settings
    set
      workspace_id = coalesce(settings.workspace_id, stores.workspace_id),
      template_id = coalesce(nullif(settings.template_id, ''), stores.template_id, 'general-starter'),
      theme_color = coalesce(nullif(settings.theme_color, ''), stores.theme_color, settings.brand_color, '#0f172a'),
      font_style = coalesce(nullif(settings.font_style, ''), stores.font_style, 'modern'),
      layout_style = coalesce(nullif(settings.layout_style, ''), stores.layout_style, 'classic'),
      theme_settings = coalesce(settings.theme_settings, settings.settings, stores.theme_settings, '{}'::jsonb)
    from public.stores stores
    where settings.store_id = stores.id;

    create index if not exists store_theme_settings_workspace_store_idx
      on public.store_theme_settings(workspace_id, store_id);
  end if;
end $$;

alter table public.store_templates enable row level security;

drop policy if exists "active store templates are readable" on public.store_templates;

create policy "active store templates are readable"
on public.store_templates
for select
to anon, authenticated
using (is_active = true);
