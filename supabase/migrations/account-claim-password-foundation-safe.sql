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
  buyer_user_id uuid references auth.users(id) on delete set null,
  buyer_email text not null,
  buyer_name text,
  transfer_code text,
  reseller_user_id uuid references auth.users(id) on delete set null,
  activation_token text,
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
  claimed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.buyer_activation_records
  add column if not exists buyer_user_id uuid references auth.users(id) on delete set null,
  add column if not exists transfer_code text,
  add column if not exists reseller_user_id uuid references auth.users(id) on delete set null,
  add column if not exists activation_token text,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists buyer_activation_records_instance_idx
  on public.buyer_activation_records(store_instance_id);

create index if not exists buyer_activation_records_email_idx
  on public.buyer_activation_records(lower(buyer_email));

alter table public.buyer_activation_records enable row level security;

create table if not exists public.store_owner_links (
  id uuid primary key default gen_random_uuid(),
  store_instance_id uuid not null references public.store_instances(id) on delete cascade,
  buyer_user_id uuid references auth.users(id) on delete set null,
  buyer_email text not null,
  transfer_code text,
  reseller_user_id uuid references auth.users(id) on delete set null,
  activation_token text,
  activation_status text not null default 'activated'
    check (activation_status in ('pending', 'activated', 'expired', 'cancelled')),
  ownership_status text not null default 'claimed'
    check (ownership_status in ('pending_activation', 'claimed', 'active', 'awaiting_login', 'suspended', 'revoked')),
  owner_role text not null default 'primary_owner'
    check (owner_role in ('primary_owner', 'owner', 'team_owner')),
  is_primary_owner boolean not null default true,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.store_access_permissions (
  id uuid primary key default gen_random_uuid(),
  store_owner_link_id uuid references public.store_owner_links(id) on delete cascade,
  store_instance_id uuid not null references public.store_instances(id) on delete cascade,
  buyer_user_id uuid references auth.users(id) on delete cascade,
  buyer_email text not null,
  reseller_user_id uuid references auth.users(id) on delete set null,
  access_role text not null default 'owner'
    check (access_role in ('owner', 'admin', 'staff', 'viewer')),
  access_status text not null default 'active'
    check (access_status in ('pending', 'active', 'revoked')),
  activation_status text not null default 'activated'
    check (activation_status in ('pending', 'activated', 'expired', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists store_owner_links_instance_idx
  on public.store_owner_links(store_instance_id);

create index if not exists store_owner_links_buyer_idx
  on public.store_owner_links(buyer_user_id, created_at desc);

create index if not exists store_owner_links_email_idx
  on public.store_owner_links(lower(buyer_email));

create unique index if not exists store_owner_links_instance_buyer_unique_idx
  on public.store_owner_links(store_instance_id, buyer_user_id)
  where buyer_user_id is not null;

create index if not exists store_access_permissions_instance_idx
  on public.store_access_permissions(store_instance_id);

create index if not exists store_access_permissions_buyer_idx
  on public.store_access_permissions(buyer_user_id, access_status);

create unique index if not exists store_access_permissions_instance_buyer_role_idx
  on public.store_access_permissions(store_instance_id, buyer_user_id, access_role)
  where buyer_user_id is not null;

alter table public.store_owner_links enable row level security;
alter table public.store_access_permissions enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'buyer_activation_records'
      and policyname = 'Buyers view own activation records'
  ) then
    create policy "Buyers view own activation records"
      on public.buyer_activation_records for select
      using (
        buyer_user_id = auth.uid()
        or lower(buyer_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'buyer_activation_records'
      and policyname = 'Resellers view own buyer activation records'
  ) then
    create policy "Resellers view own buyer activation records"
      on public.buyer_activation_records for select
      using (reseller_user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'store_owner_links'
      and policyname = 'Buyers view own store owner links'
  ) then
    create policy "Buyers view own store owner links"
      on public.store_owner_links for select
      using (
        buyer_user_id = auth.uid()
        or lower(buyer_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'store_owner_links'
      and policyname = 'Resellers view own sold store owner links'
  ) then
    create policy "Resellers view own sold store owner links"
      on public.store_owner_links for select
      using (reseller_user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'store_access_permissions'
      and policyname = 'Buyers view own store access permissions'
  ) then
    create policy "Buyers view own store access permissions"
      on public.store_access_permissions for select
      using (
        buyer_user_id = auth.uid()
        or lower(buyer_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'store_access_permissions'
      and policyname = 'Resellers view own sold store access permissions'
  ) then
    create policy "Resellers view own sold store access permissions"
      on public.store_access_permissions for select
      using (reseller_user_id = auth.uid());
  end if;

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

do $$
begin
  if exists (
    select 1
    from pg_proc
    where proname = 'set_store_instances_updated_at'
  ) then
    if not exists (select 1 from pg_trigger where tgname = 'buyer_activation_records_updated_at') then
      create trigger buyer_activation_records_updated_at
        before update on public.buyer_activation_records
        for each row execute function public.set_store_instances_updated_at();
    end if;

    if not exists (select 1 from pg_trigger where tgname = 'store_owner_links_updated_at') then
      create trigger store_owner_links_updated_at
        before update on public.store_owner_links
        for each row execute function public.set_store_instances_updated_at();
    end if;

    if not exists (select 1 from pg_trigger where tgname = 'store_access_permissions_updated_at') then
      create trigger store_access_permissions_updated_at
        before update on public.store_access_permissions
        for each row execute function public.set_store_instances_updated_at();
    end if;
  end if;
end $$;

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
      when tokens.activation_status = 'activated' then 'awaiting_login'
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
  where tokens.activation_token = normalized
  limit 1;
end;
$$;

drop function if exists public.activate_store_by_token(text);

create or replace function public.activate_store_by_token(candidate_token text)
returns table (
  activation_status text,
  store_slug text,
  ownership_status text,
  transfer_destination text,
  auth_attachment_status text,
  owner_link_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized text := trim(coalesce(candidate_token, ''));
  activation_row public.store_activation_tokens%rowtype;
  request_row public.store_purchase_requests%rowtype;
  store_row public.store_instances%rowtype;
  claim_mode text;
  claim_destination text;
  resolved_owner uuid;
  effective_owner uuid;
  created_owner_link_id uuid;
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
    select store_instances.internal_slug, store_instances.ownership_status, store_owner_links.id
      into store_slug, ownership_status, owner_link_id
    from public.store_instances
    left join public.store_owner_links
      on store_owner_links.store_instance_id = store_instances.id
    where store_instances.id = activation_row.store_instance_id
    order by store_owner_links.created_at desc
    limit 1;
    transfer_destination := claim_destination;
    auth_attachment_status := case
      when owner_link_id is not null then 'attached_or_prepared'
      else 'already_processed'
    end;
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
    auth_attachment_status := 'expired';
    owner_link_id := null;
    return next;
    return;
  end if;

  resolved_owner := auth.uid();
  effective_owner := coalesce(store_row.owner_user_id, resolved_owner);

  update public.store_activation_tokens
    set activation_status = 'activated',
        activated_at = now()
  where id = activation_row.id;

  update public.provisioned_stores
    set ownership_status = 'claimed',
        provisioning_status = 'delivered',
        buyer_user_id = coalesce(buyer_user_id, effective_owner)
  where purchase_request_id = activation_row.purchase_request_id;

  update public.store_instances
    set status = case when resolved_owner is null then 'delivered' else 'transferred' end,
        visibility = 'private',
        buyer_email = activation_row.buyer_email,
        ownership_status = 'claimed',
        owner_user_id = coalesce(owner_user_id, effective_owner),
        updated_at = now()
  where id = activation_row.store_instance_id;

  update public.store_transfers
    set transfer_status = case
          when effective_owner is null then 'awaiting_login'
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
    effective_owner,
    activation_row.buyer_email,
    activation_row.buyer_name,
    activation_row.transfer_code,
    store_row.reseller_user_id,
    activation_row.activation_token,
    request_row.target_account_id,
    claim_mode,
    claim_destination,
    'claimed',
    'activated',
    case
      when effective_owner is null then 'placeholder_pending'
      else 'awaiting_supabase_invite'
    end
  )
  on conflict (activation_token_id) do update
    set ownership_status = 'claimed',
        activation_status = 'activated',
        buyer_user_id = coalesce(buyer_activation_records.buyer_user_id, excluded.buyer_user_id),
        transfer_code = excluded.transfer_code,
        reseller_user_id = excluded.reseller_user_id,
        activation_token = excluded.activation_token,
        updated_at = now(),
        claimed_at = now();

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
    effective_owner,
    activation_row.buyer_email,
    activation_row.transfer_code,
    store_row.reseller_user_id,
    activation_row.activation_token,
    'activated',
    case when effective_owner is null then 'awaiting_login' else 'claimed' end,
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

  if created_owner_link_id is null then
    select id
      into created_owner_link_id
    from public.store_owner_links
    where store_instance_id = activation_row.store_instance_id
      and buyer_email = activation_row.buyer_email
    order by created_at desc
    limit 1;
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
    effective_owner,
    activation_row.buyer_email,
    store_row.reseller_user_id,
    'owner',
    case when effective_owner is null then 'pending' else 'active' end,
    'activated'
  )
  on conflict (store_instance_id, buyer_user_id, access_role) where buyer_user_id is not null do update
    set store_owner_link_id = excluded.store_owner_link_id,
        access_status = 'active',
        activation_status = 'activated',
        buyer_email = excluded.buyer_email,
        updated_at = now();

  select internal_slug, ownership_status
    into store_slug, ownership_status
  from public.store_instances
  where id = activation_row.store_instance_id;

  activation_status := 'activated';
  transfer_destination := claim_destination;
  auth_attachment_status := case
    when effective_owner is null then 'onboarding_placeholder_prepared'
    else 'attached_to_auth_user'
  end;
  owner_link_id := created_owner_link_id;
  return next;
end;
$$;

drop function if exists public.get_claimed_store_instances_for_current_user();

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
  owner_link_id uuid,
  access_role text,
  access_status text,
  auth_attachment_status text,
  source_reseller_name text,
  buyer_email text,
  target_account_id text,
  transfer_destination text,
  claim_account_mode text,
  requested_domain text,
  connected_domain text,
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
    owner_links.id as owner_link_id,
    coalesce(permissions.access_role, 'owner') as access_role,
    coalesce(permissions.access_status, 'pending') as access_status,
    case
      when owner_links.buyer_user_id is not null then 'attached_to_auth_user'
      when owner_links.id is not null then 'onboarding_placeholder_prepared'
      else 'not_attached'
    end as auth_attachment_status,
    profiles.display_name as source_reseller_name,
    coalesce(instances.buyer_email, tokens.buyer_email) as buyer_email,
    requests.target_account_id,
    coalesce(claims.transfer_destination, 'new_account_placeholder') as transfer_destination,
    coalesce(claims.claim_account_mode, 'new_account') as claim_account_mode,
    domains.requested_domain,
    domains.connected_domain,
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
  left join public.store_owner_links owner_links
    on owner_links.store_instance_id = instances.id
  left join public.store_access_permissions permissions
    on permissions.store_owner_link_id = owner_links.id
    and permissions.access_status in ('pending', 'active')
  left join public.store_instance_domains domains
    on domains.store_instance_id = instances.id
  left join public.reseller_profiles profiles
    on profiles.id = tokens.reseller_id
  where
    instances.owner_user_id = auth.uid()
    or owner_links.buyer_user_id = auth.uid()
    or permissions.buyer_user_id = auth.uid()
    or (
      viewer_email <> ''
      and lower(coalesce(instances.buyer_email, owner_links.buyer_email, permissions.buyer_email, tokens.buyer_email, '')) = viewer_email
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
