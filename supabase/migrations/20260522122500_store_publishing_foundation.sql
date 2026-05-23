-- Store publishing foundation for buyer-owned storefront previews.
-- Additive only: owner-scoped publish/unpublish control for store_instances.visibility.

create or replace function public.set_storefront_publication_state(
  candidate_store_instance_id uuid,
  publish_store boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  store_row public.store_instances%rowtype;
  next_visibility text := case when publish_store then 'public' else 'private' end;
  next_store_status text := case when publish_store then 'active' else 'draft' end;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1
    from public.get_claimed_store_instances_for_current_user() claimed
    where claimed.id = candidate_store_instance_id
      and coalesce(claimed.access_role, 'owner') in ('owner', 'admin')
  ) then
    raise exception 'not authorized to publish this store';
  end if;

  update public.store_instances
    set visibility = next_visibility,
        updated_at = now()
  where id = candidate_store_instance_id
  returning * into store_row;

  if store_row.id is null then
    raise exception 'store instance not found';
  end if;

  update public.store_settings
    set store_status = next_store_status,
        updated_at = now()
  where store_instance_id = candidate_store_instance_id;

  return jsonb_build_object(
    'id', store_row.id,
    'slug', store_row.internal_slug,
    'visibility', store_row.visibility,
    'published', publish_store
  );
end;
$$;

grant execute on function public.set_storefront_publication_state(uuid, boolean) to authenticated;

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
      'status', coalesce(settings.store_status, case when instances.visibility = 'public' then 'active' else 'draft' end),
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

