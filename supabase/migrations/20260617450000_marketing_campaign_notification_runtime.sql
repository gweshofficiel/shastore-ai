-- MK-25: Marketing campaign notification runtime foundation.
-- Additive notification readiness summaries only. No sending, provider, or job integration.

create table if not exists public.marketing_campaign_notification_summaries (
  id uuid primary key default gen_random_uuid(),
  registry_key text not null unique,
  campaign_code text not null default '',
  notification_channel_label text not null default '',
  notification_template_label text not null default '',
  notification_status text not null default 'foundation',
  notification_summary text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketing_campaign_notification_summaries_registry_key_check
    check (registry_key ~ '^[a-z0-9][a-z0-9:_-]{0,159}$'),
  constraint marketing_campaign_notification_summaries_campaign_code_check
    check (campaign_code ~ '^[A-Z0-9][A-Z0-9_-]{0,63}$' or campaign_code = ''),
  constraint marketing_campaign_notification_summaries_notification_status_check
    check (notification_status in ('foundation', 'disabled', 'placeholder', 'ready'))
);

create index if not exists marketing_campaign_notification_summaries_registry_key_idx
  on public.marketing_campaign_notification_summaries(registry_key);

create index if not exists marketing_campaign_notification_summaries_notification_status_idx
  on public.marketing_campaign_notification_summaries(notification_status, updated_at desc);

alter table public.marketing_campaign_notification_summaries enable row level security;

drop policy if exists "service role can manage marketing campaign notification summaries" on public.marketing_campaign_notification_summaries;
create policy "service role can manage marketing campaign notification summaries"
on public.marketing_campaign_notification_summaries
for all
to service_role
using (true)
with check (true);

create or replace function public.marketing_campaign_notification_summaries_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists marketing_campaign_notification_summaries_updated_at on public.marketing_campaign_notification_summaries;
create trigger marketing_campaign_notification_summaries_updated_at
before update on public.marketing_campaign_notification_summaries
for each row
execute function public.marketing_campaign_notification_summaries_set_updated_at();

create or replace function public.marketing_campaign_notification_summaries_guard_metadata()
returns trigger
language plpgsql
as $$
declare
  metadata_text text;
begin
  if new.notification_status not in ('foundation', 'disabled', 'placeholder', 'ready') then
    raise exception 'Invalid marketing campaign notification_status: %', new.notification_status;
  end if;

  metadata_text := lower(new.metadata::text);

  if metadata_text like '%api_key%' or metadata_text like '%apikey%' then
    raise exception 'Marketing campaign notification metadata must not contain API secrets';
  end if;

  if metadata_text like '%password%' or metadata_text like '%secret%' or metadata_text like '%token%' then
    raise exception 'Marketing campaign notification metadata must not contain secrets';
  end if;

  if metadata_text like '%@%.%' then
    raise exception 'Marketing campaign notification metadata must not contain email addresses';
  end if;

  if metadata_text like '%phone%' or metadata_text like '%whatsapp%' or metadata_text like '%sms%' then
    raise exception 'Marketing campaign notification metadata must not contain private contact identifiers';
  end if;

  return new;
end;
$$;

drop trigger if exists marketing_campaign_notification_summaries_guard_metadata on public.marketing_campaign_notification_summaries;
create trigger marketing_campaign_notification_summaries_guard_metadata
before insert or update of metadata, notification_status
on public.marketing_campaign_notification_summaries
for each row
execute function public.marketing_campaign_notification_summaries_guard_metadata();

insert into public.marketing_campaign_notification_summaries (
  registry_key,
  campaign_code,
  notification_channel_label,
  notification_template_label,
  notification_status,
  notification_summary,
  metadata
)
values
  (
    'campaign:platform-announcements',
    'CAM-PLATFORM-ANNOUNCEMENTS',
    'In-app notification',
    'Platform announcement notification placeholder',
    'foundation',
    'Foundation notification readiness summary. No notification sending or provider integration.',
    '{"source":"marketing_campaign_notification_seed"}'::jsonb
  )
on conflict (registry_key) do nothing;
