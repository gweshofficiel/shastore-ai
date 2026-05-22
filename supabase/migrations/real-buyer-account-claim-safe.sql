-- Real buyer account claim flow for SHASTORE AI.
-- Additive only: keeps the existing activation/provisioning/PDF/RLS foundations intact.

create extension if not exists "pgcrypto";

alter table public.store_activation_tokens
  add column if not exists activation_token_hash text,
  add column if not exists activation_token_hash_algorithm text not null default 'sha256';

update public.store_activation_tokens
  set activation_token_hash = encode(digest(activation_token, 'sha256'), 'hex')
where activation_token_hash is null
  and coalesce(activation_token, '') <> '';

create unique index if not exists store_activation_tokens_token_hash_unique_idx
  on public.store_activation_tokens(activation_token_hash)
  where activation_token_hash is not null;

alter table public.store_activation_tokens
  drop constraint if exists store_activation_tokens_activation_status_check;

alter table public.store_activation_tokens
  add constraint store_activation_tokens_activation_status_check
  check (activation_status in ('pending', 'claimed', 'activated', 'expired', 'revoked', 'cancelled'));

drop function if exists public.get_store_activation_by_token(text);

create or replace function public.get_store_activation_by_token(candidate_token text)
returns table (
  activation_status text,
  buyer_email text,
  buyer_name text,
  expires_at timestamptz,
  store_instance_id uuid,
  store_name text,
  store_slug text,
  transfer_code text,
  target_account_id text,
  target_account_lookup_status text,
  account_claim_mode text,
  transfer_destination text,
  auth_attachment_status text,
  owner_link_id uuid,
  access_role text,
  requested_domain text,
  connected_domain text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized text := trim(coalesce(candidate_token, ''));
  normalized_hash text := encode(digest(normalized, 'sha256'), 'hex');
begin
  return query
  select
    case
      when tokens.activation_status = 'pending' and tokens.expires_at < now() then 'expired'
      else tokens.activation_status
    end as activation_status,
    tokens.buyer_email,
    tokens.buyer_name,
    tokens.expires_at,
    tokens.store_instance_id,
    instances.store_name,
    instances.internal_slug as store_slug,
    tokens.transfer_code,
    requests.target_account_id,
    requests.target_account_lookup_status,
    case
      when coalesce(requests.target_account_id, '') <> '' then 'existing_account'
      else 'new_account'
    end as account_claim_mode,
    case
      when coalesce(requests.target_account_id, '') <> '' then 'existing_account'
      else 'new_account_placeholder'
    end as transfer_destination,
    case
      when owner_links.buyer_user_id is not null then 'attached_to_auth_user'
      when tokens.activation_status in ('claimed', 'activated') then 'awaiting_login'
      else 'not_attached'
    end as auth_attachment_status,
    owner_links.id as owner_link_id,
    coalesce(permissions.access_role, 'owner') as access_role,
    domains.requested_domain,
    domains.connected_domain
  from public.store_activation_tokens tokens
  join public.store_instances instances on instances.id = tokens.store_instance_id
  join public.store_purchase_requests requests on requests.id = tokens.purchase_request_id
  left join public.store_owner_links owner_links on owner_links.store_instance_id = instances.id
  left join public.store_access_permissions permissions
    on permissions.store_owner_link_id = owner_links.id
    and permissions.access_status in ('pending', 'active')
  left join public.store_instance_domains domains on domains.store_instance_id = instances.id
  where tokens.activation_token_hash = normalized_hash
    or tokens.activation_token = normalized
  limit 1;
end;
$$;

drop function if exists public.claim_store_activation_for_current_user(text);

create or replace function public.claim_store_activation_for_current_user(candidate_token text)
returns table (
  claim_status text,
  activation_status text,
  store_slug text,
  ownership_status text,
  auth_attachment_status text,
  owner_link_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized text := trim(coalesce(candidate_token, ''));
  normalized_hash text := encode(digest(normalized, 'sha256'), 'hex');
  activation_row public.store_activation_tokens%rowtype;
  request_row public.store_purchase_requests%rowtype;
  store_row public.store_instances%rowtype;
  viewer_id uuid := auth.uid();
  viewer_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  buyer_email_normalized text;
  target_account_matches boolean := false;
  existing_foreign_owner_link_id uuid;
  created_owner_link_id uuid;
begin
  if viewer_id is null then
    claim_status := 'auth_required';
    activation_status := null;
    store_slug := null;
    ownership_status := null;
    auth_attachment_status := 'not_attached';
    owner_link_id := null;
    return next;
    return;
  end if;

  select *
    into activation_row
  from public.store_activation_tokens
  where activation_token_hash = normalized_hash
    or activation_token = normalized
  limit 1;

  if activation_row.id is null then
    claim_status := 'not_found';
    activation_status := 'not_found';
    store_slug := null;
    ownership_status := null;
    auth_attachment_status := 'not_found';
    owner_link_id := null;
    return next;
    return;
  end if;

  select *
    into request_row
  from public.store_purchase_requests
  where id = activation_row.purchase_request_id;

  select *
    into store_row
  from public.store_instances
  where id = activation_row.store_instance_id;

  buyer_email_normalized := lower(coalesce(activation_row.buyer_email, ''));

  if coalesce(request_row.target_account_id, '') <> '' then
    select exists (
      select 1
      from public.account_profiles
      where user_id = viewer_id
        and account_id = request_row.target_account_id
        and account_type = 'user'
    )
      into target_account_matches;
  end if;

  if activation_row.activation_status = 'pending' and activation_row.expires_at < now() then
    update public.store_activation_tokens
      set activation_status = 'expired'
    where id = activation_row.id;

    claim_status := 'expired';
    activation_status := 'expired';
    store_slug := null;
    ownership_status := null;
    auth_attachment_status := 'expired';
    owner_link_id := null;
    return next;
    return;
  end if;

  if activation_row.activation_status in ('cancelled', 'revoked') then
    claim_status := activation_row.activation_status;
    activation_status := activation_row.activation_status;
    store_slug := store_row.internal_slug;
    ownership_status := store_row.ownership_status;
    auth_attachment_status := activation_row.activation_status;
    owner_link_id := null;
    return next;
    return;
  end if;

  if not (
    viewer_email = buyer_email_normalized
    or store_row.owner_user_id = viewer_id
    or target_account_matches
  ) then
    claim_status := 'email_mismatch';
    activation_status := activation_row.activation_status;
    store_slug := store_row.internal_slug;
    ownership_status := store_row.ownership_status;
    auth_attachment_status := 'not_attached';
    owner_link_id := null;
    return next;
    return;
  end if;

  if store_row.owner_user_id is not null and store_row.owner_user_id <> viewer_id then
    claim_status := 'claimed_by_other_account';
    activation_status := activation_row.activation_status;
    store_slug := store_row.internal_slug;
    ownership_status := store_row.ownership_status;
    auth_attachment_status := 'attached_to_auth_user';
    owner_link_id := null;
    return next;
    return;
  end if;

  select id
    into existing_foreign_owner_link_id
  from public.store_owner_links
  where store_instance_id = activation_row.store_instance_id
    and buyer_user_id is not null
    and buyer_user_id <> viewer_id
  limit 1;

  if existing_foreign_owner_link_id is not null then
    claim_status := 'claimed_by_other_account';
    activation_status := activation_row.activation_status;
    store_slug := store_row.internal_slug;
    ownership_status := store_row.ownership_status;
    auth_attachment_status := 'attached_to_auth_user';
    owner_link_id := existing_foreign_owner_link_id;
    return next;
    return;
  end if;

  update public.store_activation_tokens
    set activation_status = 'claimed',
        activated_at = coalesce(activated_at, now())
  where id = activation_row.id;

  update public.provisioned_stores
    set ownership_status = 'claimed',
        provisioning_status = 'delivered',
        buyer_user_id = viewer_id
  where purchase_request_id = activation_row.purchase_request_id
    and (buyer_user_id is null or buyer_user_id = viewer_id);

  update public.store_instances
    set status = 'transferred',
        visibility = 'private',
        buyer_email = activation_row.buyer_email,
        ownership_status = 'claimed',
        owner_user_id = viewer_id,
        updated_at = now()
  where id = activation_row.store_instance_id
    and (owner_user_id is null or owner_user_id = viewer_id);

  update public.store_transfers
    set transfer_status = 'delivered',
        delivery_status = 'delivered',
        ownership_assigned = true,
        transferred_at = coalesce(transferred_at, now()),
        updated_at = now()
  where purchase_request_id = activation_row.purchase_request_id;

  update public.store_purchase_requests
    set request_status = 'delivered'
  where id = activation_row.purchase_request_id;

  insert into public.buyer_activation_records (
    activation_token_id,
    purchase_request_id,
    store_instance_id,
    buyer_user_id,
    buyer_email,
    buyer_name,
    transfer_code,
    reseller_user_id,
    activation_token,
    target_account_id,
    claim_account_mode,
    transfer_destination,
    ownership_status,
    activation_status,
    password_setup_status
  )
  values (
    activation_row.id,
    activation_row.purchase_request_id,
    activation_row.store_instance_id,
    viewer_id,
    activation_row.buyer_email,
    activation_row.buyer_name,
    activation_row.transfer_code,
    store_row.reseller_user_id,
    activation_row.activation_token,
    request_row.target_account_id,
    case when coalesce(request_row.target_account_id, '') <> '' then 'existing_account' else 'new_account' end,
    case when coalesce(request_row.target_account_id, '') <> '' then 'existing_account' else 'new_account_placeholder' end,
    'claimed',
    'activated',
    'completed'
  )
  on conflict (activation_token_id) do update
    set buyer_user_id = excluded.buyer_user_id,
        ownership_status = 'claimed',
        activation_status = 'activated',
        password_setup_status = 'completed',
        transfer_code = excluded.transfer_code,
        reseller_user_id = excluded.reseller_user_id,
        activation_token = excluded.activation_token,
        updated_at = now(),
        claimed_at = coalesce(buyer_activation_records.claimed_at, now());

  select id
    into created_owner_link_id
  from public.store_owner_links
  where store_instance_id = activation_row.store_instance_id
    and buyer_user_id = viewer_id
  order by created_at desc
  limit 1;

  if created_owner_link_id is null then
    select id
      into created_owner_link_id
    from public.store_owner_links
    where store_instance_id = activation_row.store_instance_id
      and buyer_user_id is null
      and lower(buyer_email) = buyer_email_normalized
    order by created_at desc
    limit 1;

    if created_owner_link_id is not null then
      update public.store_owner_links
        set buyer_user_id = viewer_id,
            buyer_email = activation_row.buyer_email,
            transfer_code = activation_row.transfer_code,
            reseller_user_id = store_row.reseller_user_id,
            activation_token = activation_row.activation_token,
            activation_status = 'activated',
            ownership_status = 'claimed',
            owner_role = 'primary_owner',
            is_primary_owner = true,
            claimed_at = coalesce(claimed_at, now()),
            updated_at = now()
      where id = created_owner_link_id;
    else
      insert into public.store_owner_links (
        store_instance_id,
        buyer_user_id,
        buyer_email,
        transfer_code,
        reseller_user_id,
        activation_token,
        activation_status,
        ownership_status,
        owner_role,
        is_primary_owner,
        claimed_at
      )
      values (
        activation_row.store_instance_id,
        viewer_id,
        activation_row.buyer_email,
        activation_row.transfer_code,
        store_row.reseller_user_id,
        activation_row.activation_token,
        'activated',
        'claimed',
        'primary_owner',
        true,
        now()
      )
      on conflict (store_instance_id, buyer_user_id) where buyer_user_id is not null do update
        set activation_status = 'activated',
            ownership_status = 'claimed',
            buyer_email = excluded.buyer_email,
            transfer_code = excluded.transfer_code,
            activation_token = excluded.activation_token,
            claimed_at = coalesce(store_owner_links.claimed_at, now()),
            updated_at = now()
      returning id into created_owner_link_id;
    end if;
  else
    update public.store_owner_links
      set activation_status = 'activated',
          ownership_status = 'claimed',
          buyer_email = activation_row.buyer_email,
          transfer_code = activation_row.transfer_code,
          activation_token = activation_row.activation_token,
          claimed_at = coalesce(claimed_at, now()),
          updated_at = now()
    where id = created_owner_link_id;
  end if;

  insert into public.store_access_permissions (
    store_owner_link_id,
    store_instance_id,
    buyer_user_id,
    buyer_email,
    reseller_user_id,
    access_role,
    access_status,
    activation_status
  )
  values (
    created_owner_link_id,
    activation_row.store_instance_id,
    viewer_id,
    activation_row.buyer_email,
    store_row.reseller_user_id,
    'owner',
    'active',
    'activated'
  )
  on conflict (store_instance_id, buyer_user_id, access_role) where buyer_user_id is not null do update
    set store_owner_link_id = excluded.store_owner_link_id,
        access_status = 'active',
        activation_status = 'activated',
        buyer_email = excluded.buyer_email,
        updated_at = now();

  claim_status := 'claimed';
  activation_status := 'claimed';
  store_slug := store_row.internal_slug;
  ownership_status := 'claimed';
  auth_attachment_status := 'attached_to_auth_user';
  owner_link_id := created_owner_link_id;
  return next;
end;
$$;

grant execute on function public.claim_store_activation_for_current_user(text) to authenticated;
