-- MK-22: Marketing commission runtime foundation.
-- Additive commission summaries only. No settlement, payout, billing, or payment integration.

create table if not exists public.marketing_commission_summaries (
  id uuid primary key default gen_random_uuid(),
  registry_key text not null unique,
  program_code text not null default '',
  marketing_type text not null default 'referral',
  commission_model_label text not null default '',
  commission_rate_label text not null default '',
  estimated_commission_display text not null default '',
  tracked_conversions_count integer not null default 0,
  commission_status text not null default 'foundation',
  commission_summary text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketing_commission_summaries_registry_key_check
    check (registry_key ~ '^[a-z0-9][a-z0-9:_-]{0,159}$'),
  constraint marketing_commission_summaries_program_code_check
    check (program_code ~ '^[A-Z0-9][A-Z0-9_-]{0,63}$' or program_code = ''),
  constraint marketing_commission_summaries_marketing_type_check
    check (marketing_type in ('referral', 'affiliate')),
  constraint marketing_commission_summaries_tracked_conversions_count_check
    check (tracked_conversions_count >= 0),
  constraint marketing_commission_summaries_commission_status_check
    check (commission_status in ('foundation', 'disabled', 'placeholder', 'ready'))
);

create index if not exists marketing_commission_summaries_registry_key_idx
  on public.marketing_commission_summaries(registry_key);

create index if not exists marketing_commission_summaries_commission_status_idx
  on public.marketing_commission_summaries(commission_status, updated_at desc);

alter table public.marketing_commission_summaries enable row level security;

drop policy if exists "service role can manage marketing commission summaries" on public.marketing_commission_summaries;
create policy "service role can manage marketing commission summaries"
on public.marketing_commission_summaries
for all
to service_role
using (true)
with check (true);

create or replace function public.marketing_commission_summaries_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists marketing_commission_summaries_updated_at on public.marketing_commission_summaries;
create trigger marketing_commission_summaries_updated_at
before update on public.marketing_commission_summaries
for each row
execute function public.marketing_commission_summaries_set_updated_at();

create or replace function public.marketing_commission_summaries_guard_metadata()
returns trigger
language plpgsql
as $$
declare
  metadata_text text;
begin
  if coalesce(new.tracked_conversions_count, 0) < 0 then
    raise exception 'Marketing commission tracked_conversions_count cannot be negative';
  end if;

  if new.marketing_type not in ('referral', 'affiliate') then
    raise exception 'Invalid marketing commission marketing_type: %', new.marketing_type;
  end if;

  if new.commission_status not in ('foundation', 'disabled', 'placeholder', 'ready') then
    raise exception 'Invalid marketing commission commission_status: %', new.commission_status;
  end if;

  metadata_text := lower(new.metadata::text);

  if metadata_text like '%api_key%' or metadata_text like '%apikey%' then
    raise exception 'Marketing commission metadata must not contain API secrets';
  end if;

  if metadata_text like '%password%' or metadata_text like '%secret%' or metadata_text like '%token%' then
    raise exception 'Marketing commission metadata must not contain secrets';
  end if;

  if metadata_text like '%@%.%' then
    raise exception 'Marketing commission metadata must not contain email addresses';
  end if;

  if metadata_text like '%iban%' or metadata_text like '%bank_account%' or metadata_text like '%payout%' then
    raise exception 'Marketing commission metadata must not contain payout credentials';
  end if;

  return new;
end;
$$;

drop trigger if exists marketing_commission_summaries_guard_metadata on public.marketing_commission_summaries;
create trigger marketing_commission_summaries_guard_metadata
before insert or update of metadata, tracked_conversions_count, commission_status, marketing_type
on public.marketing_commission_summaries
for each row
execute function public.marketing_commission_summaries_guard_metadata();

insert into public.marketing_commission_summaries (
  registry_key,
  program_code,
  marketing_type,
  commission_model_label,
  commission_rate_label,
  estimated_commission_display,
  tracked_conversions_count,
  commission_status,
  commission_summary,
  metadata
)
values
  (
    'referral:owner-invite',
    'REF-OWNER-INVITE',
    'referral',
    'Referral invite commission',
    '0% placeholder',
    '0.00 placeholder',
    0,
    'foundation',
    'Foundation commission summary. No commission settlement or payout integration.',
    '{"source":"marketing_commission_seed"}'::jsonb
  ),
  (
    'affiliate:creator-partners',
    'AFF-CREATOR-PARTNERS',
    'affiliate',
    'Creator partner commission',
    '0% placeholder',
    '0.00 placeholder',
    0,
    'foundation',
    'Foundation commission summary. No commission settlement or payout integration.',
    '{"source":"marketing_commission_seed"}'::jsonb
  )
on conflict (registry_key) do nothing;
