-- EM-1: Email registry runtime foundation.
-- Additive registry only. No email sending, queue execution, provider calls, or template editing.

create table if not exists public.email_registry_items (
  id uuid primary key default gen_random_uuid(),
  registry_key text not null unique,
  name text not null,
  slug text not null unique,
  registry_type text not null,
  status text not null default 'draft',
  category text not null default '',
  provider_key text not null default '',
  description text not null default '',
  usage_count integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint email_registry_items_registry_key_check
    check (registry_key ~ '^[a-z0-9][a-z0-9:_-]{0,159}$'),
  constraint email_registry_items_slug_check
    check (slug ~ '^[a-z0-9][a-z0-9_-]{0,159}$'),
  constraint email_registry_items_registry_type_check
    check (registry_type in ('provider', 'template', 'transactional_section', 'queue_summary', 'campaign_scope', 'future_hook')),
  constraint email_registry_items_status_check
    check (status in ('draft', 'active', 'placeholder', 'configured', 'missing', 'healthy', 'failed', 'monitoring', 'reserved_placeholder', 'unknown', 'disabled')),
  constraint email_registry_items_usage_count_check
    check (usage_count >= 0)
);

create index if not exists email_registry_items_type_status_idx
  on public.email_registry_items(registry_type, status, updated_at desc);

create index if not exists email_registry_items_provider_key_idx
  on public.email_registry_items(provider_key, updated_at desc);

alter table public.email_registry_items enable row level security;

drop policy if exists "service role can manage email registry items" on public.email_registry_items;
create policy "service role can manage email registry items"
on public.email_registry_items
for all
to service_role
using (true)
with check (true);

create or replace function public.email_registry_items_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists email_registry_items_updated_at on public.email_registry_items;
create trigger email_registry_items_updated_at
before update on public.email_registry_items
for each row
execute function public.email_registry_items_set_updated_at();

create or replace function public.email_registry_items_guard_metadata()
returns trigger
language plpgsql
as $$
declare
  metadata_text text;
begin
  if new.registry_type not in ('provider', 'template', 'transactional_section', 'queue_summary', 'campaign_scope', 'future_hook') then
    raise exception 'Invalid registry_type: %', new.registry_type;
  end if;

  if new.status not in ('draft', 'active', 'placeholder', 'configured', 'missing', 'healthy', 'failed', 'monitoring', 'reserved_placeholder', 'unknown', 'disabled') then
    raise exception 'Invalid email registry status: %', new.status;
  end if;

  if coalesce(new.usage_count, 0) < 0 then
    raise exception 'Email registry usage_count cannot be negative';
  end if;

  metadata_text := lower(new.metadata::text);

  if metadata_text like '%api_key%' or metadata_text like '%apikey%' then
    raise exception 'Email registry metadata must not contain API secrets';
  end if;

  if metadata_text like '%smtp_%' or metadata_text like '%password%' or metadata_text like '%secret%' or metadata_text like '%token%' then
    raise exception 'Email registry metadata must not contain secrets';
  end if;

  if metadata_text like '%private_key%' or metadata_text like '%privatekey%' then
    raise exception 'Email registry metadata must not contain private keys';
  end if;

  if metadata_text like '%@%' then
    raise exception 'Email registry metadata must not contain email addresses';
  end if;

  return new;
end;
$$;

drop trigger if exists email_registry_items_guard_metadata on public.email_registry_items;
create trigger email_registry_items_guard_metadata
before insert or update of metadata, registry_type, status, usage_count
on public.email_registry_items
for each row
execute function public.email_registry_items_guard_metadata();

insert into public.email_registry_items (
  registry_key,
  slug,
  name,
  registry_type,
  status,
  category,
  provider_key,
  description,
  usage_count,
  metadata
)
values
  (
    'provider:resend',
    'resend',
    'Resend',
    'provider',
    'configured',
    'provider',
    'resend',
    'Primary platform email provider foundation.',
    0,
    '{"source":"email_registry_seed"}'::jsonb
  ),
  (
    'provider:smtp-placeholder',
    'smtp-placeholder',
    'SMTP placeholder',
    'provider',
    'placeholder',
    'provider',
    'smtp',
    'SMTP provider placeholder foundation only.',
    0,
    '{"source":"email_registry_seed"}'::jsonb
  ),
  (
    'provider:future-placeholder',
    'future-placeholder',
    'Future providers placeholder',
    'provider',
    'placeholder',
    'provider',
    'future',
    'Reserved placeholder for future email providers.',
    0,
    '{"source":"email_registry_seed"}'::jsonb
  ),
  (
    'template:welcome-platform-user',
    'welcome-platform-user',
    'Platform welcome email',
    'template',
    'draft',
    'welcome',
    '',
    'Platform welcome email template foundation.',
    0,
    '{"template_id":"welcome:platform-user","language":"English","source":"email_registry_seed"}'::jsonb
  ),
  (
    'template:billing-subscription-activated',
    'billing-subscription-activated',
    'Subscription activated',
    'template',
    'active',
    'billing',
    '',
    'Subscription activated billing email template foundation.',
    0,
    '{"template_id":"billing:subscription-activated","language":"English","source":"email_registry_seed"}'::jsonb
  ),
  (
    'template:billing-payment-failed',
    'billing-payment-failed',
    'Payment failed',
    'template',
    'active',
    'billing',
    '',
    'Payment failed billing email template foundation.',
    0,
    '{"template_id":"billing:payment-failed","language":"English","source":"email_registry_seed"}'::jsonb
  ),
  (
    'template:order-platform-receipt-placeholder',
    'order-platform-receipt-placeholder',
    'Platform order receipt placeholder',
    'template',
    'draft',
    'order',
    '',
    'Platform order receipt placeholder template foundation.',
    0,
    '{"template_id":"order:platform-receipt-placeholder","language":"English","source":"email_registry_seed"}'::jsonb
  ),
  (
    'template:domain-email-setup-instructions',
    'domain-email-setup-instructions',
    'Domain and email setup instructions',
    'template',
    'draft',
    'domain_email_setup',
    '',
    'Domain and email setup instructions template foundation.',
    0,
    '{"template_id":"domain-email:setup-instructions","language":"English","source":"email_registry_seed"}'::jsonb
  ),
  (
    'template:support-ticket-update',
    'support-ticket-update',
    'Support ticket update',
    'template',
    'draft',
    'support',
    '',
    'Support ticket update email template foundation.',
    0,
    '{"template_id":"support:ticket-update","language":"English","source":"email_registry_seed"}'::jsonb
  ),
  (
    'template:security-account-alert',
    'security-account-alert',
    'Security account alert',
    'template',
    'draft',
    'security',
    '',
    'Security account alert email template foundation.',
    0,
    '{"template_id":"security:account-alert","language":"English","source":"email_registry_seed"}'::jsonb
  ),
  (
    'transactional:welcome-emails',
    'welcome-emails',
    'Welcome emails',
    'transactional_section',
    'draft',
    'welcome',
    '',
    'Platform onboarding email foundation only.',
    0,
    '{"section_key":"welcome","note":"Platform onboarding email foundation only.","source":"email_registry_seed"}'::jsonb
  ),
  (
    'transactional:billing-emails',
    'billing-emails',
    'Billing emails',
    'transactional_section',
    'active',
    'billing',
    '',
    'Uses existing billing notification email templates when provider is configured.',
    0,
    '{"section_key":"billing","note":"Uses existing billing notification email templates when provider is configured.","source":"email_registry_seed"}'::jsonb
  ),
  (
    'transactional:order-emails',
    'order-emails',
    'Order emails',
    'transactional_section',
    'placeholder',
    'order',
    '',
    'Store order emails remain managed by Store Owner email systems.',
    0,
    '{"section_key":"order","note":"Store order emails remain managed by Store Owner email systems.","source":"email_registry_seed"}'::jsonb
  ),
  (
    'transactional:domain-email-setup-emails',
    'domain-email-setup-emails',
    'Domain/email setup emails',
    'transactional_section',
    'draft',
    'domain_email_setup',
    '',
    'Professional Email mailbox setup remains in Domains & Hosting.',
    0,
    '{"section_key":"domain_email_setup","note":"Professional Email mailbox setup remains in Domains & Hosting.","source":"email_registry_seed"}'::jsonb
  ),
  (
    'transactional:support-emails',
    'support-emails',
    'Support emails',
    'transactional_section',
    'draft',
    'support',
    '',
    'Support notification email templates are reserved placeholders.',
    0,
    '{"section_key":"support","note":"Support notification email templates are reserved placeholders.","source":"email_registry_seed"}'::jsonb
  ),
  (
    'transactional:security-emails',
    'security-emails',
    'Security emails',
    'transactional_section',
    'draft',
    'security',
    '',
    'Security alert email templates are reserved placeholders.',
    0,
    '{"section_key":"security","note":"Security alert email templates are reserved placeholders.","source":"email_registry_seed"}'::jsonb
  ),
  (
    'queue-summary:foundation',
    'queue-summary-foundation',
    'Email queue summary foundation',
    'queue_summary',
    'monitoring',
    'queue',
    '',
    'Read-only queue summary foundation. Counts are computed from email event logs.',
    0,
    '{"source":"email_registry_seed"}'::jsonb
  ),
  (
    'campaign-scope:platform-campaigns',
    'platform-campaigns',
    'Platform campaigns',
    'campaign_scope',
    'placeholder',
    'campaign',
    '',
    'Platform campaign email sending is reserved for a future safe queue.',
    0,
    '{"note":"Platform campaign email sending is reserved for a future safe queue.","source":"email_registry_seed"}'::jsonb
  ),
  (
    'campaign-scope:store-owner-campaigns',
    'store-owner-campaigns',
    'Store Owner campaigns summary',
    'campaign_scope',
    'monitoring',
    'campaign',
    '',
    'Read-only summary only. Store Owner campaigns are not edited in Super Admin Email Center.',
    0,
    '{"note":"Read-only summary only. Store Owner campaigns are not edited in Super Admin Email Center.","source":"email_registry_seed"}'::jsonb
  ),
  (
    'future-hook:edit-template',
    'edit-template',
    'Edit template',
    'future_hook',
    'reserved_placeholder',
    'future_hook',
    '',
    'Reserved placeholder for future template editing.',
    0,
    '{"source":"email_registry_seed"}'::jsonb
  ),
  (
    'future-hook:send-test-email',
    'send-test-email',
    'Send test email',
    'future_hook',
    'reserved_placeholder',
    'future_hook',
    '',
    'Reserved placeholder for future test email sending.',
    0,
    '{"source":"email_registry_seed"}'::jsonb
  ),
  (
    'future-hook:retry-failed-email',
    'retry-failed-email',
    'Retry failed email',
    'future_hook',
    'reserved_placeholder',
    'future_hook',
    '',
    'Reserved placeholder for future retry execution.',
    0,
    '{"source":"email_registry_seed"}'::jsonb
  ),
  (
    'future-hook:export-email-logs',
    'export-email-logs',
    'Export email logs',
    'future_hook',
    'reserved_placeholder',
    'future_hook',
    '',
    'Reserved placeholder for future email log export.',
    0,
    '{"source":"email_registry_seed"}'::jsonb
  ),
  (
    'future-hook:provider-health-check',
    'provider-health-check',
    'Provider health check',
    'future_hook',
    'reserved_placeholder',
    'future_hook',
    '',
    'Reserved placeholder for future provider health check execution.',
    0,
    '{"source":"email_registry_seed"}'::jsonb
  )
on conflict (registry_key) do nothing;
