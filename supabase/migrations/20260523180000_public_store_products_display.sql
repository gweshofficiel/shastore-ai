-- Public Store Products Display: expose Store Mode product catalog in storefront RPC.

create or replace function public.get_public_storefront_preview(store_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  normalized_slug text := lower(trim(coalesce(store_slug, '')));
  preview jsonb;
begin
  if normalized_slug = '' then
    return null;
  end if;

  -- Store Mode: public.stores.slug
  if to_regclass('public.stores') is not null then
    select jsonb_build_object(
      'store', jsonb_build_object(
        'id', s.id,
        'slug', s.slug,
        'title', s.name,
        'description', s.description,
        'status', 'active',
        'visibility', coalesce(ps.visibility, 'public'),
        'currency', coalesce(nullif(s.currency, ''), 'USD'),
        'whatsappNumber', s.whatsapp_number
      ),
      'branding', jsonb_build_object(
        'primaryColor', coalesce(nullif(s.brand_color, ''), '#0f172a'),
        'secondaryColor', '#2563eb',
        'themeMode', 'light'
      ),
      'products', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', p.id,
            'categoryName', c.name,
            'title', coalesce(nullif(p.name, ''), 'Untitled product'),
            'description', p.description,
            'imageUrl', p.image_url,
            'price', p.price,
            'priceLabel', coalesce(nullif(p.price, ''), null),
            'sku', null,
            'status', 'published'
          )
          order by p.sort_order asc nulls last, p.created_at asc nulls last
        )
        from public.store_products p
        left join public.store_categories c on c.id = p.category_id
        where p.store_id = s.id
      ), '[]'::jsonb)
    )
      into preview
    from public.stores s
    left join public.published_stores ps on ps.store_id = s.id
    where lower(coalesce(s.slug, '')) = normalized_slug
      and s.status = 'published'
      and coalesce(ps.status, 'published') = 'published'
      and coalesce(ps.visibility, 'public') = 'public'
    limit 1;

    if preview is not null then
      return preview;
    end if;
  end if;

  -- Legacy store_instances path
  if to_regclass('public.store_instances') is null then
    return null;
  end if;

  select jsonb_build_object(
    'store', jsonb_build_object(
      'id', instances.id,
      'slug', coalesce(settings.store_slug, instances.internal_slug),
      'title', coalesce(nullif(settings.store_name, ''), instances.store_name),
      'description', settings.store_description,
      'status', coalesce(
        settings.store_status,
        case when instances.visibility = 'public' then 'active' else 'draft' end
      ),
      'visibility', instances.visibility,
      'currency', 'USD',
      'whatsappNumber', null
    ),
    'branding', jsonb_build_object(
      'primaryColor', coalesce(nullif(branding.primary_color, ''), '#0f172a'),
      'secondaryColor', coalesce(nullif(branding.secondary_color, ''), '#2563eb'),
      'themeMode', coalesce(nullif(branding.theme_mode, ''), 'light')
    ),
    'products', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', products.id,
          'categoryName', products.category,
          'title', coalesce(nullif(products.title, ''), nullif(products.name, ''), 'Untitled product'),
          'description', products.short_description,
          'imageUrl', coalesce(nullif(products.product_data->>'imageUrl', ''), nullif(products.image_placeholder, '')),
          'price', products.price,
          'priceLabel', coalesce(nullif(products.price_label, ''), null),
          'sku', products.sku,
          'status', products.status
        )
        order by products.updated_at desc nulls last, products.created_at desc
      )
      from public.store_instance_products products
      where products.store_instance_id = instances.id
        and products.status = 'published'
    ), '[]'::jsonb)
  )
    into preview
  from public.store_instances instances
  left join public.store_settings settings
    on settings.store_instance_id = instances.id
  left join public.store_branding branding
    on branding.store_instance_id = instances.id
  where lower(coalesce(settings.store_slug, instances.internal_slug)) = normalized_slug
    and instances.owner_user_id is not null
    and instances.visibility = 'public'
  limit 1;

  return preview;
end;
$$;

grant execute on function public.get_public_storefront_preview(text) to anon;
grant execute on function public.get_public_storefront_preview(text) to authenticated;
