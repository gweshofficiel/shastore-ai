-- Shipping profiles advanced foundation.
-- Additive only: keeps existing shipping methods and prepares zones/rates.

alter table if exists public.shipping_profiles
  add column if not exists description text,
  add column if not exists enabled boolean not null default true,
  add column if not exists preparation_days integer not null default 0,
  add column if not exists estimated_delivery_days integer not null default 3,
  add column if not exists cod_supported boolean not null default true,
  add column if not exists free_shipping_enabled boolean not null default false;

update public.shipping_profiles
set enabled = case when status = 'inactive' then false else enabled end
where enabled is distinct from (case when status = 'inactive' then false else enabled end);

create index if not exists shipping_profiles_enabled_idx
on public.shipping_profiles(workspace_id, store_id, enabled, sort_order);

create index if not exists shipping_methods_profile_link_idx
on public.shipping_methods(workspace_id, store_id, profile_id);
