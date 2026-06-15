-- Platform public website content storage.
-- Additive only: no Store Owner pages, storefront pages, page builder, template engine,
-- billing, payments, subscriptions, AI control, domains, or public route behavior changes.

alter table public.platform_pages
  add column if not exists headline text null,
  add column if not exists subtitle text null,
  add column if not exists body jsonb not null default '{}'::jsonb,
  add column if not exists seo_title text null,
  add column if not exists seo_description text null,
  add column if not exists canonical_path text null,
  add column if not exists open_graph jsonb not null default '{}'::jsonb,
  add column if not exists translations jsonb not null default '{}'::jsonb,
  add column if not exists content_status text not null default 'placeholder';

alter table public.platform_pages
  alter column body set default '{}'::jsonb,
  alter column open_graph set default '{}'::jsonb,
  alter column translations set default '{}'::jsonb,
  alter column content_status set default 'placeholder';

alter table public.platform_pages
drop constraint if exists platform_pages_content_status_check;

update public.platform_pages
set
  headline = case
    when headline is null or btrim(headline) = '' then title
    else headline
  end,
  subtitle = case
    when subtitle is null or btrim(subtitle) = '' then 'Platform website content placeholder for ' || title || '.'
    else subtitle
  end,
  body = case
    when body = '{}'::jsonb then jsonb_build_object(
      'sections',
      jsonb_build_array(
        jsonb_build_object(
          'type', 'placeholder',
          'text', 'Editable platform website content placeholder. Public routes are not connected to this registry yet.'
        )
      )
    )
    else body
  end,
  seo_title = case
    when seo_title is null or btrim(seo_title) = '' then title || ' - SHASTORE AI'
    else seo_title
  end,
  seo_description = case
    when seo_description is null or btrim(seo_description) = '' then 'Runtime SEO placeholder for ' || title || '.'
    else seo_description
  end,
  canonical_path = case
    when canonical_path is null or btrim(canonical_path) = '' then route_path
    else canonical_path
  end,
  open_graph = case
    when open_graph = '{}'::jsonb then jsonb_build_object(
      'title', title || ' - SHASTORE AI',
      'description', 'Runtime Open Graph placeholder for ' || title || '.',
      'status', 'placeholder'
    )
    else open_graph
  end,
  translations = case
    when translations = '{}'::jsonb then jsonb_build_object(
      'en', jsonb_build_object('status', case when status = 'published' then 'ready' else 'placeholder' end),
      'ar', jsonb_build_object('status', 'placeholder'),
      'fr', jsonb_build_object('status', 'placeholder')
    )
    else translations
  end,
  content_status = case
    when content_status is null
      or btrim(content_status) = ''
      or content_status not in ('placeholder', 'draft_ready', 'ready', 'needs_attention')
      then 'placeholder'
    else content_status
  end
where is_system = true;

update public.platform_pages
set
  body = coalesce(body, '{}'::jsonb),
  open_graph = coalesce(open_graph, '{}'::jsonb),
  translations = coalesce(translations, '{}'::jsonb),
  content_status = case
    when content_status in ('placeholder', 'draft_ready', 'ready', 'needs_attention') then content_status
    else 'placeholder'
  end
where body is null
  or open_graph is null
  or translations is null
  or content_status is null
  or content_status not in ('placeholder', 'draft_ready', 'ready', 'needs_attention');

alter table public.platform_pages
  alter column body set not null,
  alter column open_graph set not null,
  alter column translations set not null,
  alter column content_status set not null;

alter table public.platform_pages
add constraint platform_pages_content_status_check
check (content_status in ('placeholder', 'draft_ready', 'ready', 'needs_attention'));
