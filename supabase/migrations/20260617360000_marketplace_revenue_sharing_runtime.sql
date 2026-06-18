-- MP-25: Marketplace revenue sharing runtime foundation.
-- Additive revenue share allocation records only. No payouts, withdrawals, or money transfer.

create table if not exists public.marketplace_revenue_shares (
  id uuid primary key default gen_random_uuid(),
  marketplace_purchase_id uuid not null references public.marketplace_purchases(id) on delete restrict,
  marketplace_item_id uuid not null references public.marketplace_items(id) on delete restrict,
  revenue_event_id uuid null references public.marketplace_revenue_events(id) on delete set null,
  creator_account_id uuid null references public.marketplace_creator_accounts(id) on delete set null,
  reseller_account_id uuid null references public.marketplace_creator_accounts(id) on delete set null,
  gross_amount numeric(14, 2) not null default 0,
  platform_share_amount numeric(14, 2) not null default 0,
  creator_share_amount numeric(14, 2) not null default 0,
  reseller_share_amount numeric(14, 2) not null default 0,
  currency text not null default 'USD',
  share_status text not null default 'pending',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketplace_revenue_shares_share_status_check
    check (share_status in ('pending', 'calculated', 'locked', 'cancelled', 'refunded')),
  constraint marketplace_revenue_shares_currency_check
    check (currency in ('USD', 'EUR', 'MAD')),
  constraint marketplace_revenue_shares_gross_amount_check
    check (gross_amount >= 0),
  constraint marketplace_revenue_shares_platform_share_amount_check
    check (platform_share_amount >= 0),
  constraint marketplace_revenue_shares_creator_share_amount_check
    check (creator_share_amount >= 0),
  constraint marketplace_revenue_shares_reseller_share_amount_check
    check (reseller_share_amount >= 0),
  constraint marketplace_revenue_shares_total_not_exceed_gross_check
    check (platform_share_amount + creator_share_amount + reseller_share_amount <= gross_amount)
);

create unique index if not exists marketplace_revenue_shares_active_purchase_idx
  on public.marketplace_revenue_shares(marketplace_purchase_id)
  where share_status in ('pending', 'calculated', 'locked');

create index if not exists marketplace_revenue_shares_item_created_idx
  on public.marketplace_revenue_shares(marketplace_item_id, created_at desc);

create index if not exists marketplace_revenue_shares_status_created_idx
  on public.marketplace_revenue_shares(share_status, created_at desc);

create index if not exists marketplace_revenue_shares_creator_created_idx
  on public.marketplace_revenue_shares(creator_account_id, created_at desc)
  where creator_account_id is not null;

create index if not exists marketplace_revenue_shares_reseller_created_idx
  on public.marketplace_revenue_shares(reseller_account_id, created_at desc)
  where reseller_account_id is not null;

create index if not exists marketplace_revenue_shares_revenue_event_idx
  on public.marketplace_revenue_shares(revenue_event_id)
  where revenue_event_id is not null;

alter table public.marketplace_revenue_shares enable row level security;

drop policy if exists "service role can manage marketplace revenue shares" on public.marketplace_revenue_shares;
create policy "service role can manage marketplace revenue shares"
on public.marketplace_revenue_shares
for all
to service_role
using (true)
with check (true);

create or replace function public.marketplace_revenue_shares_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists marketplace_revenue_shares_updated_at on public.marketplace_revenue_shares;
create trigger marketplace_revenue_shares_updated_at
before update on public.marketplace_revenue_shares
for each row
execute function public.marketplace_revenue_shares_set_updated_at();

create or replace function public.marketplace_revenue_shares_guard_metadata()
returns trigger
language plpgsql
as $$
declare
  metadata_text text;
begin
  if new.share_status not in ('pending', 'calculated', 'locked', 'cancelled', 'refunded') then
    raise exception 'Invalid marketplace share_status: %', new.share_status;
  end if;

  if new.currency not in ('USD', 'EUR', 'MAD') then
    raise exception 'Invalid marketplace revenue share currency: %', new.currency;
  end if;

  if coalesce(new.gross_amount, 0) < 0 then
    raise exception 'Marketplace revenue share gross_amount cannot be negative';
  end if;

  if coalesce(new.platform_share_amount, 0) < 0 then
    raise exception 'Marketplace revenue share platform_share_amount cannot be negative';
  end if;

  if coalesce(new.creator_share_amount, 0) < 0 then
    raise exception 'Marketplace revenue share creator_share_amount cannot be negative';
  end if;

  if coalesce(new.reseller_share_amount, 0) < 0 then
    raise exception 'Marketplace revenue share reseller_share_amount cannot be negative';
  end if;

  if coalesce(new.platform_share_amount, 0) + coalesce(new.creator_share_amount, 0) + coalesce(new.reseller_share_amount, 0)
    > coalesce(new.gross_amount, 0) then
    raise exception 'Marketplace revenue share totals cannot exceed gross_amount';
  end if;

  metadata_text := lower(new.metadata::text);

  if metadata_text like '%api_key%' or metadata_text like '%apikey%' then
    raise exception 'Marketplace revenue share metadata must not contain API secrets';
  end if;

  if metadata_text like '%password%' or metadata_text like '%secret%' or metadata_text like '%token%' then
    raise exception 'Marketplace revenue share metadata must not contain secrets';
  end if;

  if metadata_text like '%card_number%' or metadata_text like '%cvv%' or metadata_text like '%cvc%' then
    raise exception 'Marketplace revenue share metadata must not contain card data';
  end if;

  if metadata_text like '%payout%' or metadata_text like '%bank_account%' or metadata_text like '%iban%' then
    raise exception 'Marketplace revenue share metadata must not contain payout credentials';
  end if;

  if metadata_text like '%withdrawal%' or metadata_text like '%withdraw_%' or metadata_text like '%private_key%' then
    raise exception 'Marketplace revenue share metadata must not contain withdrawal credentials or private keys';
  end if;

  return new;
end;
$$;

drop trigger if exists marketplace_revenue_shares_guard_metadata on public.marketplace_revenue_shares;
create trigger marketplace_revenue_shares_guard_metadata
before insert or update of metadata, share_status, gross_amount, platform_share_amount, creator_share_amount, reseller_share_amount, currency
on public.marketplace_revenue_shares
for each row
execute function public.marketplace_revenue_shares_guard_metadata();
