-- NT-3: Notification status runtime foundation.
-- Additive registry status vocabulary only. No notification sending, queue execution, or retry workers.

alter table public.notification_registry_items
  drop constraint if exists notification_registry_items_status_check;

alter table public.notification_registry_items
  add constraint notification_registry_items_status_check
  check (
    status in (
      'configured',
      'healthy',
      'warning',
      'placeholder',
      'missing',
      'draft',
      'queued',
      'unread',
      'read',
      'sent',
      'delivered',
      'failed',
      'retry',
      'cancelled',
      'archived',
      'reviewed',
      'reserved_placeholder',
      'unknown'
    )
  );

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
    'draft',
    'queued',
    'unread',
    'read',
    'sent',
    'delivered',
    'failed',
    'retry',
    'cancelled',
    'archived',
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
