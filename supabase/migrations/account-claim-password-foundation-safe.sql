-- Account claim and password setup foundation for SHASTORE AI.
-- Additive only: buyer activation records, store instance ownership fields,
-- and expanded activation RPCs. Does not touch billing, checkout, payments,
-- shipping, template studio, reseller showcase, storefront, admin, or domains.

alter table public.store_instances
  add column if not exists buyer_email text,
  add column if not exists ownership_status text not null default 'pending_activation';

create table if not exists public.buyer_activation_records (
  id uuid primary key default gen_random_uuid(),
  activation_token_id uuid not null unique references public.store_activation_tokens(id) on delete cascade,
  purchase_request_id uuid not null references public.store_purchase_requests(id) on delete cascade,
  store_instance_id uuid not null references public.store_instances(id) on delete cascade,
  buyer_email text not null,
  buyer_name text,
  target_account_id text,
  claim_account_mode text not null default 'new_account'
    check (claim_account_mode in ('existing_account', 'new_account')),
  transfer_destination text not null default 'new_account_placeholder'
    check (transfer_destination in ('existing_account', 'new_account_placeholder')),
  ownership_status text not null default 'claimed'
    check (ownership_status in ('claimed', 'pending_activation', 'active', 'suspended')),
  activation_status text not null default 'activated'
    check (activation_status in ('pending', 'activated', 'expired', 'cancelled')),
  password_setup_status text not null default 'placeholder_pending'
    check (
      password_setup_status in (
        'placeholder_pending',
        'awaiting_supabase_invite',
        'completed'
      )
    ),
  buyer_user_id uuid,
  claimed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists buyer_activation_records_instance_idx
  on public.buyer_activation_records(store_instance_id);

create index if not exists buyer_activation_records_email_idx
  on public.buyer_activation_records(lower(buyer_email));

alter table public.buyer_activation_records enable row level security;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'store_transfers'
  ) then
    alter table public.store_transfers
      drop constraint if exists store_transfers_transfer_status_check;

    alter table public.store_transfers
      add constraint store_transfers_transfer_status_check
      check (
        transfer_status in (
          'preparing',
          'ready_for_delivery',
          'awaiting_login',
          'delivered',
          'failed'
        )
      );
  end if;
end $$;

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
  transfer_destination text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized text := trim(coalesce(candidate_token, ''));
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
    end as transfer_destination
  from public.store_activation_tokens tokens
  join public.store_instances instances on instances.id = tokens.store_instance_id
  join public.store_purchase_requests requests on requests.id = tokens.purchase_request_id
  where tokens.activation_token = normalized
  limit 1;
end;
$$;

create or replace function public.activate_store_by_token(candidate_token text)
returns table (
  activation_status text,
  store_slug text,
  ownership_status text,
  transfer_destination text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized text := trim(coalesce(candidate_token, ''));
  activation_row public.store_activation_tokens%rowtype;
  request_row public.store_purchase_requests%rowtype;
  claim_mode text;
  claim_destination text;
  resolved_owner uuid;
begin
  select *
    into activation_row
  from public.store_activation_tokens
  where activation_token = normalized
  limit 1;

  if activation_row.id is null then
    activation_status := 'not_found';
    store_slug := null;
    ownership_status := null;
    transfer_destination := null;
    return next;
    return;
  end if;

  select *
    into request_row
  from public.store_purchase_requests
  where id = activation_row.purchase_request_id;

  claim_mode := case
    when coalesce(request_row.target_account_id, '') <> '' then 'existing_account'
    else 'new_account'
  end;

  claim_destination := case
    when claim_mode = 'existing_account' then 'existing_account'
    else 'new_account_placeholder'
  end;

  if activation_row.activation_status <> 'pending' then
    activation_status := activation_row.activation_status;
    select internal_slug, ownership_status
      into store_slug, ownership_status
    from public.store_instances
    where id = activation_row.store_instance_id;
    transfer_destination := claim_destination;
    return next;
    return;
  end if;

  if activation_row.expires_at < now() then
    update public.store_activation_tokens
      set activation_status = 'expired'
    where id = activation_row.id;

    activation_status := 'expired';
    store_slug := null;
    ownership_status := null;
    transfer_destination := null;
    return next;
    return;
  end if;

  resolved_owner := auth.uid();

  update public.store_activation_tokens
    set activation_status = 'activated',
        activated_at = now()
  where id = activation_row.id;

  update public.provisioned_stores
    set ownership_status = 'claimed',
        provisioning_status = 'delivered',
        buyer_user_id = coalesce(buyer_user_id, resolved_owner)
  where purchase_request_id = activation_row.purchase_request_id;

  update public.store_instances
    set status = case when resolved_owner is null then 'delivered' else 'transferred' end,
        visibility = 'private',
        buyer_email = activation_row.buyer_email,
        ownership_status = 'claimed',
        owner_user_id = coalesce(owner_user_id, resolved_owner),
        updated_at = now()
  where id = activation_row.store_instance_id;

  update public.store_transfers
    set transfer_status = case
          when resolved_owner is null then 'awaiting_login'
          else 'delivered'
        end,
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
    buyer_email,
    buyer_name,
    target_account_id,
    claim_account_mode,
    transfer_destination,
    ownership_status,
    activation_status,
    password_setup_status,
    buyer_user_id
  )
  values (
    activation_row.id,
    activation_row.purchase_request_id,
    activation_row.store_instance_id,
    activation_row.buyer_email,
    activation_row.buyer_name,
    request_row.target_account_id,
    claim_mode,
    claim_destination,
    'claimed',
    'activated',
    case
      when resolved_owner is null then 'placeholder_pending'
      else 'awaiting_supabase_invite'
    end,
    resolved_owner
  )
  on conflict (activation_token_id) do update
    set ownership_status = 'claimed',
        activation_status = 'activated',
        buyer_user_id = coalesce(buyer_activation_records.buyer_user_id, excluded.buyer_user_id),
        claimed_at = now();

  select internal_slug, ownership_status
    into store_slug, ownership_status
  from public.store_instances
  where id = activation_row.store_instance_id;

  activation_status := 'activated';
  transfer_destination := claim_destination;
  return next;
end;
$$;

create or replace function public.get_claimed_store_instances_for_current_user()
returns table (
  id uuid,
  internal_slug text,
  store_name text,
  status text,
  visibility text,
  ownership_status text,
  activation_status text,
  activation_token text,
  transfer_code text,
  source_reseller_name text,
  buyer_email text,
  target_account_id text,
  transfer_destination text,
  claim_account_mode text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  viewer_email text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
begin
  if auth.uid() is null and viewer_email = '' then
    return;
  end if;

  return query
  select distinct on (instances.id)
    instances.id,
    instances.internal_slug,
    instances.store_name,
    instances.status,
    instances.visibility,
    coalesce(instances.ownership_status, provisioned.ownership_status, 'pending activation') as ownership_status,
    coalesce(tokens.activation_status, 'pending') as activation_status,
    tokens.activation_token,
    tokens.transfer_code,
    profiles.display_name as source_reseller_name,
    coalesce(instances.buyer_email, tokens.buyer_email) as buyer_email,
    requests.target_account_id,
    coalesce(claims.transfer_destination, 'new_account_placeholder') as transfer_destination,
    coalesce(claims.claim_account_mode, 'new_account') as claim_account_mode,
    instances.created_at
  from public.store_instances instances
  left join public.provisioned_stores provisioned
    on provisioned.purchase_request_id = instances.purchase_request_id
  left join public.store_activation_tokens tokens
    on tokens.store_instance_id = instances.id
  left join public.store_purchase_requests requests
    on requests.id = instances.purchase_request_id
  left join public.buyer_activation_records claims
    on claims.store_instance_id = instances.id
  left join public.reseller_profiles profiles
    on profiles.id = tokens.reseller_id
  where
    instances.owner_user_id = auth.uid()
    or (
      viewer_email <> ''
      and lower(coalesce(instances.buyer_email, tokens.buyer_email, '')) = viewer_email
    )
    or exists (
      select 1
      from public.buyer_activation_records claim_rows
      where claim_rows.store_instance_id = instances.id
        and claim_rows.buyer_user_id = auth.uid()
    )
  order by instances.id, instances.created_at desc;
end;
$$;
