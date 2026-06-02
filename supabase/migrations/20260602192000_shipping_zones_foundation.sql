-- Shipping zones foundation.
-- Additive only: keeps shipping profiles and methods intact.

alter table if exists public.shipping_zones
  add column if not exists zone_name text,
  add column if not exists enabled boolean not null default true,
  add column if not exists regions jsonb not null default '[]'::jsonb,
  add column if not exists cities jsonb not null default '[]'::jsonb;

update public.shipping_zones
set
  zone_name = coalesce(zone_name, nullif(city, ''), nullif(region, ''), country, 'Shipping zone'),
  enabled = case when status = 'inactive' then false else enabled end,
  regions = case
    when jsonb_typeof(regions) = 'array' and jsonb_array_length(regions) > 0 then regions
    when nullif(region, '') is not null then jsonb_build_array(region)
    else '[]'::jsonb
  end,
  cities = case
    when jsonb_typeof(cities) = 'array' and jsonb_array_length(cities) > 0 then cities
    when nullif(city, '') is not null then jsonb_build_array(city)
    else '[]'::jsonb
  end;

create index if not exists shipping_zones_enabled_idx
on public.shipping_zones(workspace_id, store_id, enabled, sort_order);

create index if not exists shipping_zones_country_idx
on public.shipping_zones(workspace_id, store_id, country, enabled);
