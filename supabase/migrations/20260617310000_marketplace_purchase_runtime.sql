-- MP-20: Marketplace purchase runtime foundation.
-- Additive purchase records only. No payment capture, delivery, installs, or payouts.

create table if not exists public.marketplace_purchases (
  id uuid primary key default gen_random_uuid(),
  marketplace_item_id uuid not null references public.marketplace_items(id) on delete restrict,
  buyer_account_id uuid null references auth.users(id) on delete set null,
  creator_account_id uuid null references public.marketplace_creator_accounts(id) on delete set null,
  purchase_status text not null default 'draft',
  pricing_mode text not null,
  amount numeric(14, 2) not null default 0,
  currency text not null default 'USD',
  payment_provider text not null default 'none',
  external_payment_id text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketplace_purchases_pricing_mode_check
    check (pricing_mode in ('free', 'paid', 'subscription')),
  constraint marketplace_purchases_currency_check
    check (currency in ('USD', 'EUR', 'MAD')),
  constraint marketplace_purchases_purchase_status_check
    check (purchase_status in ('draft', 'pending_payment', 'paid', 'failed', 'cancelled', 'refunded')),
  constraint marketplace_purchases_payment_provider_check
    check (payment_provider in ('none', 'internal', 'manual', 'stripe_foundation')),
  constraint marketplace_purchases_amount_check
    check (amount >= 0)
);

create index if not exists marketplace_purchases_item_created_idx
  on public.marketplace_purchases(marketplace_item_id, created_at desc);

create index if not exists marketplace_purchases_status_created_idx
  on public.marketplace_purchases(purchase_status, created_at desc);

create index if not exists marketplace_purchases_buyer_created_idx
  on public.marketplace_purchases(buyer_account_id, created_at desc)
  where buyer_account_id is not null;

create index if not exists marketplace_purchases_creator_created_idx
  on public.marketplace_purchases(creator_account_id, created_at desc)
  where creator_account_id is not null;

alter table public.marketplace_purchases enable row level security;

drop policy if exists "service role can manage marketplace purchases" on public.marketplace_purchases;
create policy "service role can manage marketplace purchases"
on public.marketplace_purchases
for all
to service_role
using (true)
with check (true);

create or replace function public.marketplace_purchases_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists marketplace_purchases_updated_at on public.marketplace_purchases;
create trigger marketplace_purchases_updated_at
before update on public.marketplace_purchases
for each row
execute function public.marketplace_purchases_set_updated_at();

create or replace function public.marketplace_purchases_guard_metadata()
returns trigger
language plpgsql
as $$
declare
  metadata_text text;
begin
  if new.pricing_mode not in ('free', 'paid', 'subscription') then
    raise exception 'Invalid marketplace purchase pricing_mode: %', new.pricing_mode;
  end if;

  if new.currency not in ('USD', 'EUR', 'MAD') then
    raise exception 'Invalid marketplace purchase currency: %', new.currency;
  end if;

  if new.purchase_status not in ('draft', 'pending_payment', 'paid', 'failed', 'cancelled', 'refunded') then
    raise exception 'Invalid marketplace purchase_status: %', new.purchase_status;
  end if;

  if new.payment_provider not in ('none', 'internal', 'manual', 'stripe_foundation') then
    raise exception 'Invalid marketplace payment_provider: %', new.payment_provider;
  end if;

  if coalesce(new.amount, 0) < 0 then
    raise exception 'Marketplace purchase amount cannot be negative';
  end if;

  if new.pricing_mode = 'free' and coalesce(new.amount, 0) > 0 then
    raise exception 'Free marketplace purchases must have amount = 0';
  end if;

  if new.pricing_mode in ('paid', 'subscription') and coalesce(new.amount, 0) <= 0 then
    raise exception 'Paid marketplace purchases must have amount > 0';
  end if;

  metadata_text := lower(new.metadata::text);

  if metadata_text like '%api_key%' or metadata_text like '%apikey%' then
    raise exception 'Marketplace purchase metadata must not contain API secrets';
  end if;

  if metadata_text like '%password%' or metadata_text like '%secret%' or metadata_text like '%token%' then
    raise exception 'Marketplace purchase metadata must not contain secrets';
  end if;

  if metadata_text like '%card_number%' or metadata_text like '%cvv%' or metadata_text like '%cvc%' then
    raise exception 'Marketplace purchase metadata must not contain card data';
  end if;

  if metadata_text like '%payout%' or metadata_text like '%bank_account%' or metadata_text like '%iban%' then
    raise exception 'Marketplace purchase metadata must not contain payout credentials';
  end if;

  return new;
end;
$$;

drop trigger if exists marketplace_purchases_guard_metadata on public.marketplace_purchases;
create trigger marketplace_purchases_guard_metadata
before insert or update of metadata, pricing_mode, amount, currency, purchase_status, payment_provider
on public.marketplace_purchases
for each row
execute function public.marketplace_purchases_guard_metadata();
