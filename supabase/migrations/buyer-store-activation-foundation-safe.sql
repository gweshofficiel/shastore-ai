-- Buyer store activation and ownership claim foundation for SHASTORE AI.
-- Additive only: scoped to activation tokens and ownership claim placeholders.
-- Does not touch platform billing, Stripe subscriptions, checkout, payments,
-- shipping, template studio, reseller showcase, public storefront rendering,
-- admin billing, or domain systems.

create table if not exists public.store_activation_tokens (
  id uuid primary key default gen_random_uuid(),
  activation_token text not null unique,
  buyer_email text not null,
  buyer_name text,
  store_instance_id uuid not null references public.store_instances(id) on delete cascade,
  purchase_request_id uuid not null unique references public.store_purchase_requests(id) on delete cascade,
  reseller_id uuid not null references public.reseller_profiles(id) on delete cascade,
  transfer_code text not null,
  activation_status text not null default 'pending'
    check (activation_status in ('pending', 'activated', 'expired', 'cancelled')),
  expires_at timestamptz not null default (now() + interval '14 days'),
  created_at timestamptz not null default now(),
  activated_at timestamptz
);

create index if not exists store_activation_tokens_reseller_status_idx
  on public.store_activation_tokens(reseller_id, activation_status, created_at desc);

create index if not exists store_activation_tokens_instance_idx
  on public.store_activation_tokens(store_instance_id);

alter table public.store_activation_tokens enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'store_activation_tokens'
      and policyname = 'Resellers manage own store activation tokens'
  ) then
    create policy "Resellers manage own store activation tokens"
      on public.store_activation_tokens for all
      using (
        exists (
          select 1
          from public.reseller_profiles profiles
          where profiles.id = store_activation_tokens.reseller_id
            and profiles.user_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1
          from public.reseller_profiles profiles
          where profiles.id = store_activation_tokens.reseller_id
            and profiles.user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'store_activation_tokens'
      and policyname = 'Admins read all store activation tokens'
  ) then
    create policy "Admins read all store activation tokens"
      on public.store_activation_tokens for select
      using (
        coalesce(auth.jwt() ->> 'role', '') = 'admin'
        or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
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
  target_account_lookup_status text
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
    requests.target_account_lookup_status
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
  store_slug text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized text := trim(coalesce(candidate_token, ''));
  activation_row public.store_activation_tokens%rowtype;
begin
  select *
    into activation_row
  from public.store_activation_tokens
  where activation_token = normalized
  limit 1;

  if activation_row.id is null then
    activation_status := 'not_found';
    store_slug := null;
    return next;
    return;
  end if;

  if activation_row.activation_status <> 'pending' then
    activation_status := activation_row.activation_status;
    select internal_slug into store_slug
    from public.store_instances
    where id = activation_row.store_instance_id;
    return next;
    return;
  end if;

  if activation_row.expires_at < now() then
    update public.store_activation_tokens
      set activation_status = 'expired'
    where id = activation_row.id;

    activation_status := 'expired';
    store_slug := null;
    return next;
    return;
  end if;

  update public.store_activation_tokens
    set activation_status = 'activated',
        activated_at = now()
  where id = activation_row.id;

  update public.provisioned_stores
    set ownership_status = 'claimed',
        provisioning_status = 'delivered'
  where purchase_request_id = activation_row.purchase_request_id;

  update public.store_instances
    set status = 'transferred',
        visibility = 'private'
  where id = activation_row.store_instance_id;

  update public.store_transfers
    set transfer_status = 'delivered',
        delivery_status = 'delivered',
        transferred_at = coalesce(transferred_at, now())
  where purchase_request_id = activation_row.purchase_request_id;

  update public.store_purchase_requests
    set request_status = 'delivered'
  where id = activation_row.purchase_request_id;

  select internal_slug into store_slug
  from public.store_instances
  where id = activation_row.store_instance_id;

  activation_status := 'activated';
  return next;
end;
$$;
