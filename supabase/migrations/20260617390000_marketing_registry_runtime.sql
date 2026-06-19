-- MK-1: Marketing registry runtime foundation.
-- Additive registry only. No coupon redemption, payouts, email sending, or campaign analytics.

create table if not exists public.marketing_registry_items (
  id uuid primary key default gen_random_uuid(),
  registry_key text not null unique,
  name text not null,
  slug text not null unique,
  marketing_type text not null,
  status text not null default 'draft',
  target_audience text not null default '',
  description text not null default '',
  revenue_impact numeric(14, 2) not null default 0,
  usage_count integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketing_registry_items_registry_key_check
    check (registry_key ~ '^[a-z0-9][a-z0-9:_-]{0,159}$'),
  constraint marketing_registry_items_slug_check
    check (slug ~ '^[a-z0-9][a-z0-9_-]{0,159}$'),
  constraint marketing_registry_items_marketing_type_check
    check (marketing_type in ('coupon', 'promotion', 'gift_code', 'referral', 'affiliate', 'campaign')),
  constraint marketing_registry_items_status_check
    check (status in ('draft', 'active', 'paused', 'expired', 'archived')),
  constraint marketing_registry_items_revenue_impact_check
    check (revenue_impact >= 0),
  constraint marketing_registry_items_usage_count_check
    check (usage_count >= 0)
);

create index if not exists marketing_registry_items_type_status_idx
  on public.marketing_registry_items(marketing_type, status, updated_at desc);

create index if not exists marketing_registry_items_status_updated_idx
  on public.marketing_registry_items(status, updated_at desc);

alter table public.marketing_registry_items enable row level security;

drop policy if exists "service role can manage marketing registry items" on public.marketing_registry_items;
create policy "service role can manage marketing registry items"
on public.marketing_registry_items
for all
to service_role
using (true)
with check (true);

create or replace function public.marketing_registry_items_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists marketing_registry_items_updated_at on public.marketing_registry_items;
create trigger marketing_registry_items_updated_at
before update on public.marketing_registry_items
for each row
execute function public.marketing_registry_items_set_updated_at();

create or replace function public.marketing_registry_items_guard_metadata()
returns trigger
language plpgsql
as $$
declare
  metadata_text text;
begin
  if new.marketing_type not in ('coupon', 'promotion', 'gift_code', 'referral', 'affiliate', 'campaign') then
    raise exception 'Invalid marketing_type: %', new.marketing_type;
  end if;

  if new.status not in ('draft', 'active', 'paused', 'expired', 'archived') then
    raise exception 'Invalid marketing status: %', new.status;
  end if;

  if coalesce(new.revenue_impact, 0) < 0 then
    raise exception 'Marketing revenue_impact cannot be negative';
  end if;

  if coalesce(new.usage_count, 0) < 0 then
    raise exception 'Marketing usage_count cannot be negative';
  end if;

  metadata_text := lower(new.metadata::text);

  if metadata_text like '%api_key%' or metadata_text like '%apikey%' then
    raise exception 'Marketing metadata must not contain API secrets';
  end if;

  if metadata_text like '%password%' or metadata_text like '%secret%' or metadata_text like '%token%' then
    raise exception 'Marketing metadata must not contain secrets';
  end if;

  if metadata_text like '%card_number%' or metadata_text like '%cvv%' or metadata_text like '%cvc%' then
    raise exception 'Marketing metadata must not contain card data';
  end if;

  if metadata_text like '%payout%' or metadata_text like '%bank_%' or metadata_text like '%iban%' then
    raise exception 'Marketing metadata must not contain payout credentials';
  end if;

  if metadata_text like '%private_key%' or metadata_text like '%privatekey%' then
    raise exception 'Marketing metadata must not contain private keys';
  end if;

  return new;
end;
$$;

drop trigger if exists marketing_registry_items_guard_metadata on public.marketing_registry_items;
create trigger marketing_registry_items_guard_metadata
before insert or update of metadata, marketing_type, status, revenue_impact, usage_count
on public.marketing_registry_items
for each row
execute function public.marketing_registry_items_guard_metadata();

insert into public.marketing_registry_items (
  registry_key,
  slug,
  name,
  marketing_type,
  status,
  target_audience,
  description,
  revenue_impact,
  usage_count,
  metadata
)
values
  (
    'platform-coupon:welcome-plan-credit',
    'welcome-plan-credit',
    'Welcome Plan Credit',
    'coupon',
    'draft',
    'New SHASTORE platform subscribers',
    'Platform coupon foundation for welcome plan credit.',
    0,
    0,
    '{"section":"Platform coupons","source":"marketing_registry_seed"}'::jsonb
  ),
  (
    'platform-promotion:annual-upgrade',
    'annual-upgrade',
    'Annual Upgrade Promotion',
    'promotion',
    'draft',
    'Monthly plan customers',
    'Platform promotion foundation for annual upgrade incentives.',
    0,
    0,
    '{"section":"Platform promotions","source":"marketing_registry_seed"}'::jsonb
  ),
  (
    'gift-code:launch-credit',
    'launch-credit',
    'Launch Credit Gift Code',
    'gift_code',
    'draft',
    'Selected launch partners',
    'Gift code foundation for launch credit distribution.',
    0,
    0,
    '{"section":"Gift codes","source":"marketing_registry_seed"}'::jsonb
  ),
  (
    'referral:owner-invite',
    'owner-invite',
    'Store Owner Referral Foundation',
    'referral',
    'draft',
    'Existing store owners',
    'Referral program foundation for store owner invites.',
    0,
    0,
    '{"section":"Referral program","source":"marketing_registry_seed"}'::jsonb
  ),
  (
    'affiliate:creator-partners',
    'creator-partners',
    'Creator Affiliate Foundation',
    'affiliate',
    'draft',
    'Creators, agencies, and future reseller partners',
    'Affiliate program foundation for creator partnerships.',
    0,
    0,
    '{"section":"Affiliate program","source":"marketing_registry_seed"}'::jsonb
  ),
  (
    'campaign:platform-announcements',
    'platform-announcements',
    'Platform Announcement Campaign',
    'campaign',
    'paused',
    'All SHASTORE platform users',
    'Campaign foundation for platform-wide announcements.',
    0,
    0,
    '{"section":"Campaigns","source":"marketing_registry_seed"}'::jsonb
  )
on conflict (registry_key) do nothing;
