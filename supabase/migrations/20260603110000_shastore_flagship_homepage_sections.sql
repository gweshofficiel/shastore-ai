-- SHASTORE Flagship Premium section keys.
-- Additive only: preserves existing homepage sections, RLS, and store isolation.

alter table public.store_homepage_sections
  drop constraint if exists store_homepage_sections_section_type_check;

alter table public.store_homepage_sections
  add constraint store_homepage_sections_section_type_check
  check (
    section_type in (
      'hero',
      'featured_products',
      'new_arrivals',
      'best_sellers',
      'flash_deals',
      'recommended_products',
      'recently_viewed',
      'featured_categories',
      'featured_collection',
      'brands',
      'trust_badges',
      'about_preview',
      'testimonials',
      'newsletter',
      'faq_preview',
      'blog_preview',
      'footer_cta'
    )
  );
