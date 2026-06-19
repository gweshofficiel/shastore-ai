-- MK-24: Marketing campaign email runtime foundation.
-- Additive email readiness summaries only. No sending, provider, SMTP, or mass send integration.

create table if not exists public.marketing_campaign_email_summaries (
  id uuid primary key default gen_random_uuid(),
  registry_key text not null unique,
  campaign_code text not null default '',
  email_subject_label text not null default '',
  email_template_label text not null default '',
  sender_label text not null default '',
  email_status text not null default 'foundation',
  mass_send_status text not null default 'foundation',
  email_summary text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketing_campaign_email_summaries_registry_key_check
    check (registry_key ~ '^[a-z0-9][a-z0-9:_-]{0,159}$'),
  constraint marketing_campaign_email_summaries_campaign_code_check
    check (campaign_code ~ '^[A-Z0-9][A-Z0-9_-]{0,63}$' or campaign_code = ''),
  constraint marketing_campaign_email_summaries_email_status_check
    check (email_status in ('foundation', 'disabled', 'placeholder', 'ready')),
  constraint marketing_campaign_email_summaries_mass_send_status_check
    check (mass_send_status in ('foundation', 'disabled', 'placeholder', 'ready'))
);

create index if not exists marketing_campaign_email_summaries_registry_key_idx
  on public.marketing_campaign_email_summaries(registry_key);

create index if not exists marketing_campaign_email_summaries_email_status_idx
  on public.marketing_campaign_email_summaries(email_status, updated_at desc);

alter table public.marketing_campaign_email_summaries enable row level security;

drop policy if exists "service role can manage marketing campaign email summaries" on public.marketing_campaign_email_summaries;
create policy "service role can manage marketing campaign email summaries"
on public.marketing_campaign_email_summaries
for all
to service_role
using (true)
with check (true);

create or replace function public.marketing_campaign_email_summaries_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists marketing_campaign_email_summaries_updated_at on public.marketing_campaign_email_summaries;
create trigger marketing_campaign_email_summaries_updated_at
before update on public.marketing_campaign_email_summaries
for each row
execute function public.marketing_campaign_email_summaries_set_updated_at();

create or replace function public.marketing_campaign_email_summaries_guard_metadata()
returns trigger
language plpgsql
as $$
declare
  metadata_text text;
begin
  if new.email_status not in ('foundation', 'disabled', 'placeholder', 'ready') then
    raise exception 'Invalid marketing campaign email_status: %', new.email_status;
  end if;

  if new.mass_send_status not in ('foundation', 'disabled', 'placeholder', 'ready') then
    raise exception 'Invalid marketing campaign mass_send_status: %', new.mass_send_status;
  end if;

  metadata_text := lower(new.metadata::text);

  if metadata_text like '%api_key%' or metadata_text like '%apikey%' then
    raise exception 'Marketing campaign email metadata must not contain API secrets';
  end if;

  if metadata_text like '%password%' or metadata_text like '%secret%' or metadata_text like '%token%' then
    raise exception 'Marketing campaign email metadata must not contain secrets';
  end if;

  if metadata_text like '%smtp%' or metadata_text like '%sendgrid%' or metadata_text like '%mailgun%' then
    raise exception 'Marketing campaign email metadata must not contain provider credentials';
  end if;

  if metadata_text like '%@%.%' then
    raise exception 'Marketing campaign email metadata must not contain email addresses';
  end if;

  return new;
end;
$$;

drop trigger if exists marketing_campaign_email_summaries_guard_metadata on public.marketing_campaign_email_summaries;
create trigger marketing_campaign_email_summaries_guard_metadata
before insert or update of metadata, email_status, mass_send_status
on public.marketing_campaign_email_summaries
for each row
execute function public.marketing_campaign_email_summaries_guard_metadata();

insert into public.marketing_campaign_email_summaries (
  registry_key,
  campaign_code,
  email_subject_label,
  email_template_label,
  sender_label,
  email_status,
  mass_send_status,
  email_summary,
  metadata
)
values
  (
    'campaign:platform-announcements',
    'CAM-PLATFORM-ANNOUNCEMENTS',
    'Platform announcement placeholder',
    'Platform announcement template placeholder',
    'SHASTORE Platform',
    'foundation',
    'foundation',
    'Foundation email readiness summary. No email sending or mass send integration.',
    '{"source":"marketing_campaign_email_seed"}'::jsonb
  )
on conflict (registry_key) do nothing;
