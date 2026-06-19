-- MK-9: Marketing coupon usage tracking runtime foundation.
-- Additive usage summaries only. No redemption, billing, checkout, or payment integration.

create table if not exists public.marketing_coupon_usage_summaries (
  id uuid primary key default gen_random_uuid(),
  registry_key text not null unique,
  coupon_code text not null default '',
  usage_count integer not null default 0,
  usage_limit_label text not null default '',
  tracking_status text not null default 'untracked',
  usage_summary text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketing_coupon_usage_summaries_registry_key_check
    check (registry_key ~ '^[a-z0-9][a-z0-9:_-]{0,159}$'),
  constraint marketing_coupon_usage_summaries_coupon_code_check
    check (coupon_code ~ '^[A-Z0-9][A-Z0-9_-]{0,63}$' or coupon_code = ''),
  constraint marketing_coupon_usage_summaries_usage_count_check
    check (usage_count >= 0),
  constraint marketing_coupon_usage_summaries_tracking_status_check
    check (tracking_status in ('untracked', 'foundation', 'placeholder', 'tracked'))
);

create index if not exists marketing_coupon_usage_summaries_registry_key_idx
  on public.marketing_coupon_usage_summaries(registry_key);

create index if not exists marketing_coupon_usage_summaries_tracking_status_idx
  on public.marketing_coupon_usage_summaries(tracking_status, updated_at desc);

alter table public.marketing_coupon_usage_summaries enable row level security;

drop policy if exists "service role can manage marketing coupon usage summaries" on public.marketing_coupon_usage_summaries;
create policy "service role can manage marketing coupon usage summaries"
on public.marketing_coupon_usage_summaries
for all
to service_role
using (true)
with check (true);

create or replace function public.marketing_coupon_usage_summaries_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists marketing_coupon_usage_summaries_updated_at on public.marketing_coupon_usage_summaries;
create trigger marketing_coupon_usage_summaries_updated_at
before update on public.marketing_coupon_usage_summaries
for each row
execute function public.marketing_coupon_usage_summaries_set_updated_at();

create or replace function public.marketing_coupon_usage_summaries_guard_metadata()
returns trigger
language plpgsql
as $$
declare
  metadata_text text;
begin
  if coalesce(new.usage_count, 0) < 0 then
    raise exception 'Marketing coupon usage_count cannot be negative';
  end if;

  if new.tracking_status not in ('untracked', 'foundation', 'placeholder', 'tracked') then
    raise exception 'Invalid marketing coupon tracking_status: %', new.tracking_status;
  end if;

  metadata_text := lower(new.metadata::text);

  if metadata_text like '%api_key%' or metadata_text like '%apikey%' then
    raise exception 'Marketing coupon usage metadata must not contain API secrets';
  end if;

  if metadata_text like '%password%' or metadata_text like '%secret%' or metadata_text like '%token%' then
    raise exception 'Marketing coupon usage metadata must not contain secrets';
  end if;

  if metadata_text like '%card_number%' or metadata_text like '%cvv%' or metadata_text like '%cvc%' then
    raise exception 'Marketing coupon usage metadata must not contain card data';
  end if;

  if metadata_text like '%payout%' or metadata_text like '%bank_%' or metadata_text like '%iban%' then
    raise exception 'Marketing coupon usage metadata must not contain payout credentials';
  end if;

  if metadata_text like '%private_key%' or metadata_text like '%privatekey%' then
    raise exception 'Marketing coupon usage metadata must not contain private keys';
  end if;

  return new;
end;
$$;

drop trigger if exists marketing_coupon_usage_summaries_guard_metadata on public.marketing_coupon_usage_summaries;
create trigger marketing_coupon_usage_summaries_guard_metadata
before insert or update of metadata, usage_count, tracking_status
on public.marketing_coupon_usage_summaries
for each row
execute function public.marketing_coupon_usage_summaries_guard_metadata();

insert into public.marketing_coupon_usage_summaries (
  registry_key,
  coupon_code,
  usage_count,
  usage_limit_label,
  tracking_status,
  usage_summary,
  metadata
)
values
  (
    'platform-coupon:welcome-plan-credit',
    'PLATFORM-WELCOME',
    0,
    'Placeholder limit',
    'foundation',
    'Foundation usage summary. No redemption tracking connected.',
    '{"source":"marketing_coupon_usage_seed"}'::jsonb
  ),
  (
    'platform-promotion:annual-upgrade',
    'PLAN-CREDIT-DRAFT',
    0,
    'Internal review only',
    'foundation',
    'Legacy coupon usage summary placeholder. No billing discount application.',
    '{"source":"marketing_coupon_usage_seed"}'::jsonb
  )
on conflict (registry_key) do nothing;
