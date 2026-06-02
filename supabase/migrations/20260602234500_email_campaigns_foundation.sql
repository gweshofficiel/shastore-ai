-- Email campaigns foundation.
-- Additive only: campaign drafts and recipients use the existing email_event_logs queue.

create table if not exists public.email_campaigns (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  store_id uuid not null references public.stores(id) on delete cascade,
  campaign_name text not null,
  subject text not null,
  content text not null,
  target_segment text not null default 'all_customers'
    check (target_segment in ('all_customers', 'new_customers', 'returning_customers', 'vip_customers', 'digital_product_customers')),
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'sent')),
  scheduled_at timestamptz,
  sent_at timestamptz,
  recipient_count integer not null default 0 check (recipient_count >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.email_campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  store_id uuid not null references public.stores(id) on delete cascade,
  campaign_id uuid not null references public.email_campaigns(id) on delete cascade,
  customer_id uuid,
  recipient_email text not null,
  customer_name text,
  email_event_log_id uuid references public.email_event_logs(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'queued', 'sent', 'failed', 'skipped')),
  queued_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, recipient_email)
);

create index if not exists email_campaigns_workspace_store_idx
on public.email_campaigns(workspace_id, store_id, status, created_at desc);

create index if not exists email_campaign_recipients_campaign_idx
on public.email_campaign_recipients(workspace_id, store_id, campaign_id, status);

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'email_event_logs_template_key_check'
      and conrelid = 'public.email_event_logs'::regclass
  ) then
    alter table public.email_event_logs
      drop constraint email_event_logs_template_key_check;
  end if;

  alter table public.email_event_logs
    add constraint email_event_logs_template_key_check
    check (template_key in (
      'abandoned_cart_recovery',
      'customer_welcome',
      'email_campaign',
      'low_stock_alert',
      'order_confirmation',
      'order_status_update',
      'review_reminder',
      'review_request',
      'thank_you'
    ));
end $$;

create or replace function public.set_email_campaigns_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.campaign_name = trim(new.campaign_name);
  new.subject = trim(new.subject);
  return new;
end;
$$;

drop trigger if exists email_campaigns_updated_at on public.email_campaigns;
create trigger email_campaigns_updated_at
before insert or update on public.email_campaigns
for each row execute function public.set_email_campaigns_updated_at();

create or replace function public.set_email_campaign_recipients_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.recipient_email = lower(trim(new.recipient_email));
  return new;
end;
$$;

drop trigger if exists email_campaign_recipients_updated_at on public.email_campaign_recipients;
create trigger email_campaign_recipients_updated_at
before insert or update on public.email_campaign_recipients
for each row execute function public.set_email_campaign_recipients_updated_at();

alter table public.email_campaigns enable row level security;
alter table public.email_campaign_recipients enable row level security;

drop policy if exists "workspace members read email campaigns" on public.email_campaigns;
drop policy if exists "workspace editors write email campaigns" on public.email_campaigns;
drop policy if exists "workspace members read email campaign recipients" on public.email_campaign_recipients;
drop policy if exists "workspace editors write email campaign recipients" on public.email_campaign_recipients;

create policy "workspace members read email campaigns"
on public.email_campaigns for select to authenticated
using (public.can_access_workspace(workspace_id));

create policy "workspace editors write email campaigns"
on public.email_campaigns for all to authenticated
using (public.workspace_can_edit(workspace_id))
with check (public.workspace_can_edit(workspace_id));

create policy "workspace members read email campaign recipients"
on public.email_campaign_recipients for select to authenticated
using (public.can_access_workspace(workspace_id));

create policy "workspace editors write email campaign recipients"
on public.email_campaign_recipients for all to authenticated
using (public.workspace_can_edit(workspace_id))
with check (public.workspace_can_edit(workspace_id));
