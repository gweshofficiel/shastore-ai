-- MK-19: Marketing referral tracking runtime foundation.
-- Additive tracking summaries only. No event tracking, attribution, commission, or payout integration.

create table if not exists public.marketing_referral_tracking_summaries (
  id uuid primary key default gen_random_uuid(),
  registry_key text not null unique,
  referral_code text not null default '',
  tracked_visits_count integer not null default 0,
  tracked_signups_count integer not null default 0,
  tracked_conversions_count integer not null default 0,
  tracking_status text not null default 'foundation',
  tracking_summary text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketing_referral_tracking_summaries_registry_key_check
    check (registry_key ~ '^[a-z0-9][a-z0-9:_-]{0,159}$'),
  constraint marketing_referral_tracking_summaries_referral_code_check
    check (referral_code ~ '^[A-Z0-9][A-Z0-9_-]{0,63}$' or referral_code = ''),
  constraint marketing_referral_tracking_summaries_tracked_visits_count_check
    check (tracked_visits_count >= 0),
  constraint marketing_referral_tracking_summaries_tracked_signups_count_check
    check (tracked_signups_count >= 0),
  constraint marketing_referral_tracking_summaries_tracked_conversions_count_check
    check (tracked_conversions_count >= 0),
  constraint marketing_referral_tracking_summaries_tracking_status_check
    check (tracking_status in ('foundation', 'disabled', 'placeholder', 'ready'))
);

create index if not exists marketing_referral_tracking_summaries_registry_key_idx
  on public.marketing_referral_tracking_summaries(registry_key);

create index if not exists marketing_referral_tracking_summaries_tracking_status_idx
  on public.marketing_referral_tracking_summaries(tracking_status, updated_at desc);

alter table public.marketing_referral_tracking_summaries enable row level security;

drop policy if exists "service role can manage marketing referral tracking summaries" on public.marketing_referral_tracking_summaries;
create policy "service role can manage marketing referral tracking summaries"
on public.marketing_referral_tracking_summaries
for all
to service_role
using (true)
with check (true);

create or replace function public.marketing_referral_tracking_summaries_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists marketing_referral_tracking_summaries_updated_at on public.marketing_referral_tracking_summaries;
create trigger marketing_referral_tracking_summaries_updated_at
before update on public.marketing_referral_tracking_summaries
for each row
execute function public.marketing_referral_tracking_summaries_set_updated_at();

create or replace function public.marketing_referral_tracking_summaries_guard_metadata()
returns trigger
language plpgsql
as $$
declare
  metadata_text text;
begin
  if coalesce(new.tracked_visits_count, 0) < 0
    or coalesce(new.tracked_signups_count, 0) < 0
    or coalesce(new.tracked_conversions_count, 0) < 0 then
    raise exception 'Marketing referral tracking counts cannot be negative';
  end if;

  if new.tracking_status not in ('foundation', 'disabled', 'placeholder', 'ready') then
    raise exception 'Invalid marketing referral tracking_status: %', new.tracking_status;
  end if;

  metadata_text := lower(new.metadata::text);

  if metadata_text like '%api_key%' or metadata_text like '%apikey%' then
    raise exception 'Marketing referral tracking metadata must not contain API secrets';
  end if;

  if metadata_text like '%password%' or metadata_text like '%secret%' or metadata_text like '%token%' then
    raise exception 'Marketing referral tracking metadata must not contain secrets';
  end if;

  if metadata_text like '%@%.%' then
    raise exception 'Marketing referral tracking metadata must not contain email addresses';
  end if;

  if metadata_text like '%ip_address%' or metadata_text like '%device_fingerprint%' then
    raise exception 'Marketing referral tracking metadata must not contain private tracking identifiers';
  end if;

  return new;
end;
$$;

drop trigger if exists marketing_referral_tracking_summaries_guard_metadata on public.marketing_referral_tracking_summaries;
create trigger marketing_referral_tracking_summaries_guard_metadata
before insert or update of metadata, tracked_visits_count, tracked_signups_count, tracked_conversions_count, tracking_status
on public.marketing_referral_tracking_summaries
for each row
execute function public.marketing_referral_tracking_summaries_guard_metadata();

insert into public.marketing_referral_tracking_summaries (
  registry_key,
  referral_code,
  tracked_visits_count,
  tracked_signups_count,
  tracked_conversions_count,
  tracking_status,
  tracking_summary,
  metadata
)
values
  (
    'referral:owner-invite',
    'REF-OWNER-INVITE',
    0,
    0,
    0,
    'foundation',
    'Foundation tracking summary. No referral event tracking connected.',
    '{"source":"marketing_referral_tracking_seed"}'::jsonb
  )
on conflict (registry_key) do nothing;
