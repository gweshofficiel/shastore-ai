-- Public storefront preview foundation.
-- Read-only RPC for active claimed store previews by public slug.

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

  select jsonb_build_object(
    'store', jsonb_build_object(
      'id', instances.id,
      'slug', coalesce(settings.store_slug, instances.internal_slug),
      'title', coalesce(nullif(settings.store_name, ''), instances.store_name),
      'description', settings.store_description,
      'status', settings.store_status,
      'visibility', instances.visibility
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
          'title', coalesce(nullif(products.title, ''), nullif(products.name, ''), 'Untitled product'),
          'description', products.short_description,
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
  join public.store_settings settings
    on settings.store_instance_id = instances.id
  left join public.store_branding branding
    on branding.store_instance_id = instances.id
  where lower(coalesce(settings.store_slug, instances.internal_slug)) = normalized_slug
    and instances.owner_user_id is not null
    and instances.visibility = 'public'
    and settings.store_status = 'active'
  limit 1;

  return preview;
end;
$$;

grant execute on function public.get_public_storefront_preview(text) to anon;
grant execute on function public.get_public_storefront_preview(text) to authenticated;
