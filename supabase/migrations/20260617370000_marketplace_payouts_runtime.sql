-- MP-26: Marketplace payouts runtime foundation.
-- Additive payout request records only. No real money transfer or provider payout APIs.

create table if not exists public.marketplace_payout_requests (
  id uuid primary key default gen_random_uuid(),
  creator_account_id uuid null references public.marketplace_creator_accounts(id) on delete restrict,
  reseller_account_id uuid null references public.marketplace_creator_accounts(id) on delete restrict,
  payout_status text not null default 'draft',
  payout_amount numeric(14, 2) not null default 0,
  currency text not null default 'USD',
  payout_method text not null default 'manual',
  requested_by uuid null references auth.users(id) on delete set null,
  reviewed_by uuid null references auth.users(id) on delete set null,
  requested_at timestamptz null,
  reviewed_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketplace_payout_requests_payout_status_check
    check (payout_status in ('draft', 'pending_review', 'approved', 'rejected', 'processing', 'paid', 'cancelled', 'failed')),
  constraint marketplace_payout_requests_payout_method_check
    check (payout_method in ('manual', 'external_provider_placeholder')),
  constraint marketplace_payout_requests_currency_check
    check (currency in ('USD', 'EUR', 'MAD')),
  constraint marketplace_payout_requests_payout_amount_check
    check (payout_amount >= 0),
  constraint marketplace_payout_requests_recipient_check
    check (
      (
        creator_account_id is not null
        and reseller_account_id is null
      )
      or (
        reseller_account_id is not null
        and creator_account_id is null
      )
    )
);

create unique index if not exists marketplace_payout_requests_active_creator_idx
  on public.marketplace_payout_requests(creator_account_id, currency)
  where creator_account_id is not null
    and payout_status in ('draft', 'pending_review', 'approved', 'processing');

create unique index if not exists marketplace_payout_requests_active_reseller_idx
  on public.marketplace_payout_requests(reseller_account_id, currency)
  where reseller_account_id is not null
    and payout_status in ('draft', 'pending_review', 'approved', 'processing');

create index if not exists marketplace_payout_requests_status_created_idx
  on public.marketplace_payout_requests(payout_status, created_at desc);

create index if not exists marketplace_payout_requests_creator_created_idx
  on public.marketplace_payout_requests(creator_account_id, created_at desc)
  where creator_account_id is not null;

create index if not exists marketplace_payout_requests_reseller_created_idx
  on public.marketplace_payout_requests(reseller_account_id, created_at desc)
  where reseller_account_id is not null;

create index if not exists marketplace_payout_requests_requested_by_created_idx
  on public.marketplace_payout_requests(requested_by, created_at desc)
  where requested_by is not null;

alter table public.marketplace_payout_requests enable row level security;

drop policy if exists "service role can manage marketplace payout requests" on public.marketplace_payout_requests;
create policy "service role can manage marketplace payout requests"
on public.marketplace_payout_requests
for all
to service_role
using (true)
with check (true);

create or replace function public.marketplace_payout_requests_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists marketplace_payout_requests_updated_at on public.marketplace_payout_requests;
create trigger marketplace_payout_requests_updated_at
before update on public.marketplace_payout_requests
for each row
execute function public.marketplace_payout_requests_set_updated_at();

create or replace function public.marketplace_payout_requests_guard_metadata()
returns trigger
language plpgsql
as $$
declare
  metadata_text text;
begin
  if new.payout_status not in ('draft', 'pending_review', 'approved', 'rejected', 'processing', 'paid', 'cancelled', 'failed') then
    raise exception 'Invalid marketplace payout_status: %', new.payout_status;
  end if;

  if new.payout_method not in ('manual', 'external_provider_placeholder') then
    raise exception 'Invalid marketplace payout_method: %', new.payout_method;
  end if;

  if new.currency not in ('USD', 'EUR', 'MAD') then
    raise exception 'Invalid marketplace payout currency: %', new.currency;
  end if;

  if coalesce(new.payout_amount, 0) < 0 then
    raise exception 'Marketplace payout_amount cannot be negative';
  end if;

  if (new.creator_account_id is null and new.reseller_account_id is null)
    or (new.creator_account_id is not null and new.reseller_account_id is not null) then
    raise exception 'Marketplace payout request must link to creator_account_id or reseller_account_id exclusively';
  end if;

  metadata_text := lower(new.metadata::text);

  if metadata_text like '%api_key%' or metadata_text like '%apikey%' then
    raise exception 'Marketplace payout metadata must not contain API secrets';
  end if;

  if metadata_text like '%password%' or metadata_text like '%secret%' or metadata_text like '%token%' then
    raise exception 'Marketplace payout metadata must not contain secrets';
  end if;

  if metadata_text like '%card_number%' or metadata_text like '%cvv%' or metadata_text like '%cvc%' then
    raise exception 'Marketplace payout metadata must not contain card data';
  end if;

  if metadata_text like '%bank_%' or metadata_text like '%iban%' or metadata_text like '%routing_%' then
    raise exception 'Marketplace payout metadata must not contain bank details';
  end if;

  if metadata_text like '%account_number%' or metadata_text like '%swift%' then
    raise exception 'Marketplace payout metadata must not contain bank account details';
  end if;

  if metadata_text like '%private_key%' or metadata_text like '%privatekey%' then
    raise exception 'Marketplace payout metadata must not contain private keys';
  end if;

  if metadata_text like '%stripe_%secret%' or metadata_text like '%payout_%credential%' then
    raise exception 'Marketplace payout metadata must not contain payout credentials';
  end if;

  return new;
end;
$$;

drop trigger if exists marketplace_payout_requests_guard_metadata on public.marketplace_payout_requests;
create trigger marketplace_payout_requests_guard_metadata
before insert or update of metadata, payout_status, payout_method, payout_amount, currency, creator_account_id, reseller_account_id
on public.marketplace_payout_requests
for each row
execute function public.marketplace_payout_requests_guard_metadata();
