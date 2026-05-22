-- Align store management permission checks with claimed buyer ownership resolution.
-- Additive only: does not weaken RLS or bypass tenant isolation.

create or replace function public.sync_claimed_store_owner_identity(candidate_store_instance_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  viewer_id uuid := auth.uid();
  viewer_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  instance_row public.store_instances%rowtype;
  foreign_owner uuid;
begin
  if viewer_id is null or viewer_email = '' then
    return false;
  end if;

  select *
    into instance_row
  from public.store_instances
  where id = candidate_store_instance_id;

  if instance_row.id is null then
    return false;
  end if;

  select owner_user_id
    into foreign_owner
  from public.store_instances
  where id = candidate_store_instance_id
    and owner_user_id is not null
    and owner_user_id <> viewer_id
  limit 1;

  if foreign_owner is not null then
    return false;
  end if;

  if exists (
    select 1
    from public.store_owner_links links
    where links.store_instance_id = candidate_store_instance_id
      and links.buyer_user_id is not null
      and links.buyer_user_id <> viewer_id
  ) then
    return false;
  end if;

  if not (
    instance_row.owner_user_id = viewer_id
    or lower(coalesce(instance_row.buyer_email, '')) = viewer_email
    or exists (
      select 1
      from public.store_owner_links links
      where links.store_instance_id = candidate_store_instance_id
        and lower(links.buyer_email) = viewer_email
    )
    or exists (
      select 1
      from public.buyer_activation_records claims
      where claims.store_instance_id = candidate_store_instance_id
        and (
          claims.buyer_user_id = viewer_id
          or lower(claims.buyer_email) = viewer_email
        )
    )
  ) then
    return false;
  end if;

  update public.store_instances
    set owner_user_id = viewer_id,
        buyer_email = coalesce(buyer_email, (select buyer_email from public.store_owner_links where store_instance_id = candidate_store_instance_id and lower(buyer_email) = viewer_email limit 1)),
        ownership_status = case when ownership_status = 'pending_activation' then 'claimed' else ownership_status end,
        updated_at = now()
  where id = candidate_store_instance_id
    and (owner_user_id is null or owner_user_id = viewer_id);

  update public.store_owner_links
    set buyer_user_id = viewer_id,
        ownership_status = case when ownership_status = 'awaiting_login' then 'claimed' else ownership_status end,
        updated_at = now()
  where store_instance_id = candidate_store_instance_id
    and (buyer_user_id is null or buyer_user_id = viewer_id)
    and lower(buyer_email) = viewer_email;

  update public.store_access_permissions
    set buyer_user_id = viewer_id,
        access_status = case when access_status = 'pending' then 'active' else access_status end,
        updated_at = now()
  where store_instance_id = candidate_store_instance_id
    and (buyer_user_id is null or buyer_user_id = viewer_id)
    and lower(buyer_email) = viewer_email
    and access_role = 'owner';

  update public.buyer_activation_records
    set buyer_user_id = viewer_id,
        ownership_status = 'claimed',
        password_setup_status = 'completed'
  where store_instance_id = candidate_store_instance_id
    and (buyer_user_id is null or buyer_user_id = viewer_id)
    and lower(buyer_email) = viewer_email;

  update public.provisioned_stores
    set buyer_user_id = viewer_id,
        ownership_status = 'claimed'
  where purchase_request_id = instance_row.purchase_request_id
    and (buyer_user_id is null or buyer_user_id = viewer_id);

  return true;
end;
$$;

create or replace function public.can_access_store_instance(candidate_store_instance_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.store_instances instances
    where instances.id = candidate_store_instance_id
      and (
        instances.owner_user_id = auth.uid()
        or instances.reseller_user_id = auth.uid()
        or exists (
          select 1
          from public.store_owner_links links
          where links.store_instance_id = instances.id
            and links.buyer_user_id = auth.uid()
            and links.ownership_status in ('claimed', 'active', 'awaiting_login')
        )
        or exists (
          select 1
          from public.store_access_permissions permissions
          where permissions.store_instance_id = instances.id
            and permissions.buyer_user_id = auth.uid()
            and permissions.access_status in ('active', 'pending')
        )
        or exists (
          select 1
          from public.buyer_activation_records claims
          where claims.store_instance_id = instances.id
            and claims.buyer_user_id = auth.uid()
            and claims.activation_status = 'activated'
        )
        or (
          coalesce(auth.jwt() ->> 'email', '') <> ''
          and lower(coalesce(instances.buyer_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
          and exists (
            select 1
            from public.store_owner_links links
            where links.store_instance_id = instances.id
              and lower(links.buyer_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
              and links.ownership_status in ('claimed', 'active', 'awaiting_login')
          )
        )
        or exists (
          select 1
          from public.store_staff staff
          where staff.store_instance_id = instances.id
            and staff.user_id = auth.uid()
            and staff.staff_status = 'active'
        )
      )
  );
$$;

create or replace function public.can_manage_store_instance(candidate_store_instance_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.get_claimed_store_instances_for_current_user() claimed
    where claimed.id = candidate_store_instance_id
      and coalesce(claimed.access_role, 'owner') in ('owner', 'admin')
  )
  or exists (
    select 1
    from public.store_instances instances
    where instances.id = candidate_store_instance_id
      and instances.reseller_user_id = auth.uid()
  )
  or exists (
    select 1
    from public.store_staff staff
    where staff.store_instance_id = candidate_store_instance_id
      and staff.user_id = auth.uid()
      and staff.staff_status = 'active'
      and staff.role_key in ('owner', 'admin')
  );
$$;

grant execute on function public.sync_claimed_store_owner_identity(uuid) to authenticated;
grant execute on function public.can_access_store_instance(uuid) to authenticated;
grant execute on function public.can_manage_store_instance(uuid) to authenticated;
