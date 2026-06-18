-- MP-7: Marketplace revenue runtime foundation.
-- Isolated from platform subscription billing. No payouts or purchase runtime.

create table if not exists public.marketplace_revenue_events (
  id uuid primary key default gen_random_uuid(),
  marketplace_item_id uuid not null references public.marketplace_items(id) on delete restrict,
  buyer_account_id uuid null references auth.users(id) on delete set null,
  creator_account_id uuid null references auth.users(id) on delete set null,
  pricing_mode text not null,
  gross_amount numeric(14, 2) not null default 0,
  platform_fee_amount numeric(14, 2) not null default 0,
  creator_revenue_amount numeric(14, 2) not null default 0,
  net_amount numeric(14, 2) not null default 0,
  currency text not null default 'USD',
  revenue_status text not null default 'pending',
  source text not null default 'marketplace_revenue_runtime',
  external_payment_id text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketplace_revenue_events_pricing_mode_check
    check (pricing_mode in ('free', 'paid', 'subscription')),
  constraint marketplace_revenue_events_currency_check
    check (currency in ('USD', 'EUR', 'MAD')),
  constraint marketplace_revenue_events_revenue_status_check
    check (revenue_status in ('pending', 'processed', 'failed', 'refunded', 'cancelled')),
  constraint marketplace_revenue_events_gross_amount_check
    check (gross_amount >= 0),
  constraint marketplace_revenue_events_platform_fee_amount_check
    check (platform_fee_amount >= 0),
  constraint marketplace_revenue_events_creator_revenue_amount_check
    check (creator_revenue_amount >= 0),
  constraint marketplace_revenue_events_net_amount_check
    check (net_amount >= 0),
  constraint marketplace_revenue_events_fee_not_exceed_gross_check
    check (platform_fee_amount <= gross_amount),
  constraint marketplace_revenue_events_net_matches_creator_check
    check (net_amount = creator_revenue_amount)
);

create index if not exists marketplace_revenue_events_item_created_idx
  on public.marketplace_revenue_events(marketplace_item_id, created_at desc);

create index if not exists marketplace_revenue_events_status_created_idx
  on public.marketplace_revenue_events(revenue_status, created_at desc);

create index if not exists marketplace_revenue_events_currency_created_idx
  on public.marketplace_revenue_events(currency, created_at desc);

alter table public.marketplace_revenue_events enable row level security;

drop policy if exists "service role can manage marketplace revenue events" on public.marketplace_revenue_events;
create policy "service role can manage marketplace revenue events"
on public.marketplace_revenue_events
for all
to service_role
using (true)
with check (true);

create or replace function public.marketplace_revenue_events_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists marketplace_revenue_events_updated_at on public.marketplace_revenue_events;
create trigger marketplace_revenue_events_updated_at
before update on public.marketplace_revenue_events
for each row
execute function public.marketplace_revenue_events_set_updated_at();

create or replace function public.marketplace_revenue_events_guard_amounts()
returns trigger
language plpgsql
as $$
begin
  if new.pricing_mode not in ('free', 'paid', 'subscription') then
    raise exception 'Invalid marketplace revenue pricing_mode: %', new.pricing_mode;
  end if;

  if new.currency not in ('USD', 'EUR', 'MAD') then
    raise exception 'Invalid marketplace revenue currency: %', new.currency;
  end if;

  if new.revenue_status not in ('pending', 'processed', 'failed', 'refunded', 'cancelled') then
    raise exception 'Invalid marketplace revenue_status: %', new.revenue_status;
  end if;

  if coalesce(new.gross_amount, 0) < 0 then
    raise exception 'Marketplace gross_amount cannot be negative';
  end if;

  if coalesce(new.platform_fee_amount, 0) < 0 then
    raise exception 'Marketplace platform_fee_amount cannot be negative';
  end if;

  if coalesce(new.creator_revenue_amount, 0) < 0 then
    raise exception 'Marketplace creator_revenue_amount cannot be negative';
  end if;

  if coalesce(new.net_amount, 0) < 0 then
    raise exception 'Marketplace net_amount cannot be negative';
  end if;

  if coalesce(new.platform_fee_amount, 0) > coalesce(new.gross_amount, 0) then
    raise exception 'Marketplace platform_fee_amount cannot exceed gross_amount';
  end if;

  if coalesce(new.net_amount, 0) <> coalesce(new.creator_revenue_amount, 0) then
    raise exception 'Marketplace net_amount must equal creator_revenue_amount';
  end if;

  if new.pricing_mode = 'free' and coalesce(new.gross_amount, 0) > 0 then
    raise exception 'Free marketplace revenue events must have gross_amount = 0';
  end if;

  if new.pricing_mode in ('paid', 'subscription') and coalesce(new.gross_amount, 0) <= 0 then
    raise exception 'Paid marketplace revenue events must have gross_amount > 0';
  end if;

  return new;
end;
$$;

drop trigger if exists marketplace_revenue_events_guard_amounts on public.marketplace_revenue_events;
create trigger marketplace_revenue_events_guard_amounts
before insert or update of pricing_mode, gross_amount, platform_fee_amount, creator_revenue_amount, net_amount, currency, revenue_status
on public.marketplace_revenue_events
for each row
execute function public.marketplace_revenue_events_guard_amounts();
