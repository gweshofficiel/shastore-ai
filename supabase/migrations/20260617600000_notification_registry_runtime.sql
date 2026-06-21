-- NT-1: Notification registry runtime foundation.
-- Additive registry only. No notification sending, queue execution, provider calls, or template editing.

create table if not exists public.notification_registry_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  registry_type text not null,
  channel text not null default '',
  notification_type text not null default '',
  status text not null default 'unknown',
  health text not null default '',
  configured_state text not null default '',
  secrets_state text not null default '',
  description text not null default '',
  usage_count integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_registry_items_slug_check
    check (slug ~ '^[a-z0-9][a-z0-9_-]{0,159}$'),
  constraint notification_registry_items_registry_type_check
    check (registry_type in ('channel', 'type', 'log_summary', 'provider', 'future_hook', 'metric')),
  constraint notification_registry_items_channel_check
    check (
      channel = ''
      or channel in ('in_app', 'email', 'sms', 'whatsapp', 'push', 'system_alerts')
    ),
  constraint notification_registry_items_notification_type_check
    check (
      notification_type = ''
      or notification_type in (
        'billing',
        'security',
        'domains',
        'email_setup',
        'ai_visuals',
        'store_publishing',
        'support',
        'system_health',
        'low_stock',
        'review_request',
        'thank_you'
      )
    ),
  constraint notification_registry_items_status_check
    check (
      status in (
        'configured',
        'healthy',
        'warning',
        'placeholder',
        'missing',
        'queued',
        'unread',
        'read',
        'sent',
        'failed',
        'reviewed',
        'reserved_placeholder',
        'unknown'
      )
    ),
  constraint notification_registry_items_secrets_state_check
    check (
      secrets_state = ''
      or secrets_state in ('masked_configured', 'masked_partial', 'missing', 'no_secret_required')
    ),
  constraint notification_registry_items_usage_count_check
    check (usage_count >= 0)
);

create index if not exists notification_registry_items_type_status_idx
  on public.notification_registry_items(registry_type, status, updated_at desc);

create index if not exists notification_registry_items_channel_idx
  on public.notification_registry_items(channel, updated_at desc);

alter table public.notification_registry_items enable row level security;

drop policy if exists "service role can manage notification registry items" on public.notification_registry_items;
create policy "service role can manage notification registry items"
on public.notification_registry_items
for all
to service_role
using (true)
with check (true);

create or replace function public.notification_registry_items_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists notification_registry_items_updated_at on public.notification_registry_items;
create trigger notification_registry_items_updated_at
before update on public.notification_registry_items
for each row
execute function public.notification_registry_items_set_updated_at();

create or replace function public.notification_registry_items_guard_metadata()
returns trigger
language plpgsql
as $$
declare
  metadata_text text;
begin
  if new.registry_type not in ('channel', 'type', 'log_summary', 'provider', 'future_hook', 'metric') then
    raise exception 'Invalid registry_type: %', new.registry_type;
  end if;

  if new.status not in (
    'configured',
    'healthy',
    'warning',
    'placeholder',
    'missing',
    'queued',
    'unread',
    'read',
    'sent',
    'failed',
    'reviewed',
    'reserved_placeholder',
    'unknown'
  ) then
    raise exception 'Invalid notification registry status: %', new.status;
  end if;

  if coalesce(new.usage_count, 0) < 0 then
    raise exception 'Notification registry usage_count cannot be negative';
  end if;

  metadata_text := lower(new.metadata::text);

  if metadata_text like '%api_key%' or metadata_text like '%apikey%' then
    raise exception 'Notification registry metadata must not contain API secrets';
  end if;

  if metadata_text like '%smtp_%' or metadata_text like '%password%' or metadata_text like '%secret%' or metadata_text like '%token%' then
    raise exception 'Notification registry metadata must not contain secrets';
  end if;

  if metadata_text like '%sms_%' or metadata_text like '%whatsapp_%' or metadata_text like '%push_%' then
    raise exception 'Notification registry metadata must not contain provider credentials';
  end if;

  if metadata_text like '%private_key%' or metadata_text like '%privatekey%' then
    raise exception 'Notification registry metadata must not contain private keys';
  end if;

  if metadata_text like '%@%' then
    raise exception 'Notification registry metadata must not contain email addresses';
  end if;

  if metadata_text like '%otp%' or metadata_text like '%reset_token%' then
    raise exception 'Notification registry metadata must not contain OTP or reset tokens';
  end if;

  return new;
end;
$$;

drop trigger if exists notification_registry_items_guard_metadata on public.notification_registry_items;
create trigger notification_registry_items_guard_metadata
before insert or update of metadata, registry_type, status, usage_count
on public.notification_registry_items
for each row
execute function public.notification_registry_items_guard_metadata();

insert into public.notification_registry_items (
  slug,
  name,
  registry_type,
  channel,
  notification_type,
  status,
  health,
  configured_state,
  secrets_state,
  description,
  usage_count,
  metadata
)
values
  (
    'in-app',
    'In-app',
    'channel',
    'in_app',
    '',
    'configured',
    'healthy',
    'configured',
    'no_secret_required',
    'In-app notification channel foundation.',
    0,
    '{"source":"notification_registry_seed"}'::jsonb
  ),
  (
    'email',
    'Email',
    'channel',
    'email',
    '',
    'missing',
    'missing_config',
    'missing',
    'missing',
    'Email notification channel foundation.',
    0,
    '{"source":"notification_registry_seed"}'::jsonb
  ),
  (
    'sms',
    'SMS placeholder',
    'channel',
    'sms',
    '',
    'placeholder',
    'placeholder',
    'placeholder',
    'missing',
    'SMS notification channel placeholder foundation.',
    0,
    '{"source":"notification_registry_seed"}'::jsonb
  ),
  (
    'whatsapp',
    'WhatsApp placeholder',
    'channel',
    'whatsapp',
    '',
    'placeholder',
    'placeholder',
    'placeholder',
    'missing',
    'WhatsApp notification channel placeholder foundation.',
    0,
    '{"source":"notification_registry_seed"}'::jsonb
  ),
  (
    'push',
    'Push placeholder',
    'channel',
    'push',
    '',
    'placeholder',
    'placeholder',
    'placeholder',
    'no_secret_required',
    'Push notification channel placeholder foundation.',
    0,
    '{"source":"notification_registry_seed"}'::jsonb
  ),
  (
    'system-alerts',
    'System alerts',
    'channel',
    'system_alerts',
    '',
    'configured',
    'healthy',
    'configured',
    'no_secret_required',
    'System alerts notification channel foundation.',
    0,
    '{"source":"notification_registry_seed"}'::jsonb
  ),
  (
    'billing',
    'Billing',
    'type',
    '',
    'billing',
    'configured',
    'healthy',
    'configured',
    'no_secret_required',
    'Billing notification type foundation.',
    0,
    '{"source":"notification_registry_seed"}'::jsonb
  ),
  (
    'security',
    'Security',
    'type',
    '',
    'security',
    'configured',
    'healthy',
    'configured',
    'no_secret_required',
    'Security notification type foundation.',
    0,
    '{"source":"notification_registry_seed"}'::jsonb
  ),
  (
    'domains',
    'Domains',
    'type',
    '',
    'domains',
    'configured',
    'healthy',
    'configured',
    'no_secret_required',
    'Domains notification type foundation.',
    0,
    '{"source":"notification_registry_seed"}'::jsonb
  ),
  (
    'email-setup',
    'Email setup',
    'type',
    '',
    'email_setup',
    'configured',
    'healthy',
    'configured',
    'no_secret_required',
    'Email setup notification type foundation.',
    0,
    '{"source":"notification_registry_seed"}'::jsonb
  ),
  (
    'ai-visuals',
    'AI visuals',
    'type',
    '',
    'ai_visuals',
    'configured',
    'healthy',
    'configured',
    'no_secret_required',
    'AI visuals notification type foundation.',
    0,
    '{"source":"notification_registry_seed"}'::jsonb
  ),
  (
    'store-publishing',
    'Store publishing',
    'type',
    '',
    'store_publishing',
    'configured',
    'healthy',
    'configured',
    'no_secret_required',
    'Store publishing notification type foundation.',
    0,
    '{"source":"notification_registry_seed"}'::jsonb
  ),
  (
    'support',
    'Support',
    'type',
    '',
    'support',
    'configured',
    'healthy',
    'configured',
    'no_secret_required',
    'Support notification type foundation.',
    0,
    '{"source":"notification_registry_seed"}'::jsonb
  ),
  (
    'system-health',
    'System health',
    'type',
    '',
    'system_health',
    'configured',
    'healthy',
    'configured',
    'no_secret_required',
    'System health notification type foundation.',
    0,
    '{"source":"notification_registry_seed"}'::jsonb
  ),
  (
    'email-provider',
    'Email provider',
    'provider',
    'email',
    '',
    'missing',
    'missing_config',
    'missing',
    'missing',
    'Email provider notification foundation.',
    0,
    '{"source":"notification_registry_seed"}'::jsonb
  ),
  (
    'sms-provider',
    'SMS provider',
    'provider',
    'sms',
    '',
    'placeholder',
    'placeholder',
    'placeholder',
    'missing',
    'SMS provider notification placeholder foundation.',
    0,
    '{"source":"notification_registry_seed"}'::jsonb
  ),
  (
    'whatsapp-provider',
    'WhatsApp provider',
    'provider',
    'whatsapp',
    '',
    'placeholder',
    'placeholder',
    'placeholder',
    'missing',
    'WhatsApp provider notification placeholder foundation.',
    0,
    '{"source":"notification_registry_seed"}'::jsonb
  ),
  (
    'push-provider',
    'Push provider',
    'provider',
    'push',
    '',
    'placeholder',
    'placeholder',
    'placeholder',
    'no_secret_required',
    'Push provider notification placeholder foundation.',
    0,
    '{"source":"notification_registry_seed"}'::jsonb
  ),
  (
    'in-app-low-stock-unread',
    'In-app low_stock unread',
    'log_summary',
    'in_app',
    'low_stock',
    'unread',
    'healthy',
    'configured',
    'no_secret_required',
    'In-app low_stock unread log summary foundation.',
    0,
    '{"source":"notification_registry_seed","summary_key":"in_app:low_stock:unread"}'::jsonb
  ),
  (
    'email-review-request-queued',
    'Email review_request queued',
    'log_summary',
    'email',
    'review_request',
    'queued',
    'healthy',
    'configured',
    'no_secret_required',
    'Email review_request queued log summary foundation.',
    0,
    '{"source":"notification_registry_seed","summary_key":"email:review_request:queued"}'::jsonb
  ),
  (
    'email-thank-you-queued',
    'Email thank_you queued',
    'log_summary',
    'email',
    'thank_you',
    'queued',
    'healthy',
    'configured',
    'no_secret_required',
    'Email thank_you queued log summary foundation.',
    0,
    '{"source":"notification_registry_seed","summary_key":"email:thank_you:queued"}'::jsonb
  ),
  (
    'retry-failed-notification',
    'Retry failed notification',
    'future_hook',
    '',
    '',
    'reserved_placeholder',
    'healthy',
    'configured',
    'no_secret_required',
    'Retry failed notification future hook placeholder.',
    0,
    '{"source":"notification_registry_seed"}'::jsonb
  ),
  (
    'configure-channels',
    'Configure channels',
    'future_hook',
    '',
    '',
    'reserved_placeholder',
    'placeholder',
    'placeholder',
    'no_secret_required',
    'Configure channels future hook placeholder.',
    0,
    '{"source":"notification_registry_seed"}'::jsonb
  ),
  (
    'send-test-notification',
    'Send test notification',
    'future_hook',
    '',
    '',
    'reserved_placeholder',
    'placeholder',
    'placeholder',
    'no_secret_required',
    'Send test notification future hook placeholder.',
    0,
    '{"source":"notification_registry_seed"}'::jsonb
  ),
  (
    'export-notification-logs',
    'Export notification logs',
    'future_hook',
    '',
    '',
    'reserved_placeholder',
    'placeholder',
    'placeholder',
    'no_secret_required',
    'Export notification logs future hook placeholder.',
    0,
    '{"source":"notification_registry_seed"}'::jsonb
  ),
  (
    'notification-template-editor',
    'Notification template editor',
    'future_hook',
    '',
    '',
    'reserved_placeholder',
    'placeholder',
    'placeholder',
    'no_secret_required',
    'Notification template editor future hook placeholder.',
    0,
    '{"source":"notification_registry_seed"}'::jsonb
  )
on conflict (slug) do nothing;
