-- NT-4: Notification channel runtime foundation.
-- Additive channel vocabulary only. No notification sending, provider routing, or webhook ingress.

alter table public.notification_registry_items
  drop constraint if exists notification_registry_items_channel_check;

alter table public.notification_registry_items
  add constraint notification_registry_items_channel_check
  check (
    channel = ''
    or channel in (
      'in_app',
      'email',
      'sms',
      'whatsapp',
      'push',
      'system_alert',
      'system_alerts'
    )
  );
