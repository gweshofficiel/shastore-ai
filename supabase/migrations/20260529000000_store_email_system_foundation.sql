-- Store email system foundation.
-- Queue/log only: no external email delivery is triggered by this migration.

create extension if not exists "pgcrypto";

create table if not exists public.store_email_settings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  store_id uuid not null references public.stores(id) on delete cascade,
  sender_name text,
  reply_to_email text,
  enable_order_confirmation boolean not null default true,
  enable_order_status_update boolean not null default true,
  enable_review_request boolean not null default true,
  enable_low_stock_alert boolean not null default true,
  enable_customer_welcome boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, store_id)
);

create table if not exists public.email_event_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  store_id uuid not null references public.stores(id) on delete cascade,
  recipient text not null,
  subject text not null,
  template_key text not null,
  status text not null default 'pending',
  error_message text,
  provider text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'email_event_logs_status_check'
      and conrelid = 'public.email_event_logs'::regclass
  ) then
    alter table public.email_event_logs
      add constraint email_event_logs_status_check
      check (status in ('pending', 'sent', 'failed'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'email_event_logs_template_key_check'
      and conrelid = 'public.email_event_logs'::regclass
  ) then
    alter table public.email_event_logs
      add constraint email_event_logs_template_key_check
      check (template_key in (
        'order_confirmation',
        'order_status_update',
        'review_request',
        'low_stock_alert',
        'customer_welcome'
      ));
  end if;
end $$;

create index if not exists store_email_settings_workspace_store_idx
on public.store_email_settings(workspace_id, store_id);

create index if not exists email_event_logs_workspace_store_created_idx
on public.email_event_logs(workspace_id, store_id, created_at desc);

create index if not exists email_event_logs_status_idx
on public.email_event_logs(workspace_id, store_id, status, created_at desc);

create index if not exists email_event_logs_template_idx
on public.email_event_logs(workspace_id, store_id, template_key, created_at desc);

create or replace function public.set_store_email_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.reply_to_email = nullif(lower(trim(coalesce(new.reply_to_email, ''))), '');
  new.sender_name = nullif(trim(coalesce(new.sender_name, '')), '');
  return new;
end;
$$;

drop trigger if exists store_email_settings_updated_at on public.store_email_settings;
create trigger store_email_settings_updated_at
before insert or update on public.store_email_settings
for each row execute function public.set_store_email_settings_updated_at();

create or replace function public.set_email_event_logs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.recipient = lower(trim(new.recipient));
  new.subject = trim(new.subject);
  return new;
end;
$$;

drop trigger if exists email_event_logs_updated_at on public.email_event_logs;
create trigger email_event_logs_updated_at
before insert or update on public.email_event_logs
for each row execute function public.set_email_event_logs_updated_at();

alter table public.store_email_settings enable row level security;
alter table public.email_event_logs enable row level security;

drop policy if exists "workspace members read store email settings" on public.store_email_settings;
create policy "workspace members read store email settings"
on public.store_email_settings
for select
to authenticated
using (public.can_access_workspace(workspace_id));

drop policy if exists "workspace editors write store email settings" on public.store_email_settings;
create policy "workspace editors write store email settings"
on public.store_email_settings
for all
to authenticated
using (public.workspace_can_edit(workspace_id))
with check (public.workspace_can_edit(workspace_id));

drop policy if exists "workspace members read email event logs" on public.email_event_logs;
create policy "workspace members read email event logs"
on public.email_event_logs
for select
to authenticated
using (public.can_access_workspace(workspace_id));

drop policy if exists "workspace editors write email event logs" on public.email_event_logs;
create policy "workspace editors write email event logs"
on public.email_event_logs
for all
to authenticated
using (public.workspace_can_edit(workspace_id))
with check (public.workspace_can_edit(workspace_id));

drop policy if exists "service role can manage email event logs" on public.email_event_logs;
create policy "service role can manage email event logs"
on public.email_event_logs
for all
to service_role
using (true)
with check (true);

drop policy if exists "service role can manage store email settings" on public.store_email_settings;
create policy "service role can manage store email settings"
on public.store_email_settings
for all
to service_role
using (true)
with check (true);
