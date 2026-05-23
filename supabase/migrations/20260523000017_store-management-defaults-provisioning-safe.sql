-- Fix store management default provisioning for claimed store owners.
-- Additive only: keeps RLS, ownership checks, and multi-tenant isolation.

create or replace function public.assert_store_management_manage_access(candidate_store_instance_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_claimed_store_owner_identity(candidate_store_instance_id);

  if public.can_manage_store_instance(candidate_store_instance_id) then
    return;
  end if;

  if exists (
    select 1
    from public.get_claimed_store_instances_for_current_user() claimed
    where claimed.id = candidate_store_instance_id
      and coalesce(claimed.access_role, 'owner') in ('owner', 'admin')
  ) then
    return;
  end if;

  raise exception 'not authorized to manage this store';
end;
$$;

create or replace function public.ensure_store_management_defaults(candidate_store_instance_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  instance_row public.store_instances%rowtype;
  settings_slug text;
  period_start date := date_trunc('month', timezone('utc', now()))::date;
  period_end date := (date_trunc('month', timezone('utc', now())) + interval '1 month - 1 day')::date;
begin
  perform public.assert_store_management_manage_access(candidate_store_instance_id);

  select *
    into instance_row
  from public.store_instances
  where id = candidate_store_instance_id;

  if instance_row.id is null then
    raise exception 'store instance not found';
  end if;

  insert into public.store_plan_limits (
    plan_id,
    plan_name,
    products_limit,
    storage_mb_limit,
    domains_limit,
    monthly_traffic_limit,
    ai_usage_limit,
    features
  )
  values
    ('starter', 'Starter', 100, 1024, 1, 10000, 100, '{"staff":2,"mediaFolders":true}'::jsonb),
    ('pro', 'Pro', 1000, 10240, 5, 100000, 1000, '{"staff":10,"mediaFolders":true,"customCss":true}'::jsonb),
    ('enterprise', 'Enterprise', null, null, null, null, null, '{"staff":"unlimited","mediaFolders":true,"customCss":true,"prioritySupport":true}'::jsonb)
  on conflict (plan_id) do nothing;

  settings_slug := coalesce(nullif(trim(instance_row.internal_slug), ''), 'store')
    || '-'
    || left(replace(instance_row.id::text, '-', ''), 8);

  insert into public.store_settings (
    store_instance_id,
    store_name,
    store_slug,
    store_status
  )
  values (
    instance_row.id,
    coalesce(nullif(trim(instance_row.store_name), ''), 'My Store'),
    settings_slug,
    case
      when instance_row.status in ('transferred', 'delivered') then 'active'
      else 'draft'
    end
  )
  on conflict (store_instance_id) do nothing;

  insert into public.store_branding (store_instance_id)
  values (instance_row.id)
  on conflict (store_instance_id) do nothing;

  insert into public.store_subscriptions (store_instance_id, plan_id, subscription_status)
  values (instance_row.id, 'starter', 'active')
  on conflict (store_instance_id) do nothing;

  insert into public.store_usage_tracking (
    store_instance_id,
    period_start,
    period_end
  )
  values (
    instance_row.id,
    period_start,
    period_end
  )
  on conflict (store_instance_id, period_start, period_end) do nothing;

  insert into public.store_roles (store_instance_id, role_key, role_name, role_description)
  values
    (instance_row.id, 'owner', 'Owner', 'Full store ownership and billing access.'),
    (instance_row.id, 'admin', 'Admin', 'Manage store settings, catalog, staff, media, and domains.'),
    (instance_row.id, 'editor', 'Editor', 'Manage catalog, content, media, and branding.'),
    (instance_row.id, 'support', 'Support', 'View orders and support customer workflows.')
  on conflict (store_instance_id, role_key) do nothing;

  insert into public.store_permissions (store_instance_id, role_key, permission_key, enabled)
  values
    (instance_row.id, 'owner', 'store.manage_all', true),
    (instance_row.id, 'admin', 'store.manage_settings', true),
    (instance_row.id, 'admin', 'store.manage_staff', true),
    (instance_row.id, 'admin', 'store.manage_domains', true),
    (instance_row.id, 'editor', 'store.manage_branding', true),
    (instance_row.id, 'editor', 'store.manage_media', true),
    (instance_row.id, 'support', 'store.view_support', true)
  on conflict (store_instance_id, role_key, permission_key) do nothing;

  insert into public.store_media_folders (
    store_instance_id,
    folder_name,
    folder_path
  )
  values (instance_row.id, 'Uploads', '/uploads')
  on conflict (store_instance_id, folder_path) do nothing;
end;
$$;

grant execute on function public.assert_store_management_manage_access(uuid) to authenticated;
grant execute on function public.ensure_store_management_defaults(uuid) to authenticated;
grant execute on function public.get_store_management_snapshot(uuid) to authenticated;

