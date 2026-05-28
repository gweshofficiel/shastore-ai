-- Customer lifecycle email automation foundation.
-- Additive only: lifecycle events feed the existing email_event_logs queue.

alter table public.store_email_settings
  add column if not exists enable_thank_you boolean not null default true,
  add column if not exists enable_review_reminder boolean not null default true;

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
      'order_confirmation',
      'order_status_update',
      'review_request',
      'low_stock_alert',
      'customer_welcome',
      'thank_you',
      'review_reminder'
    ));
end $$;

create table if not exists public.customer_lifecycle_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  store_id uuid not null references public.stores(id) on delete cascade,
  customer_id uuid references public.store_customers(id) on delete set null,
  order_id uuid not null,
  event_type text not null,
  scheduled_for timestamptz not null default now(),
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'customer_lifecycle_events_type_check'
      and conrelid = 'public.customer_lifecycle_events'::regclass
  ) then
    alter table public.customer_lifecycle_events
      add constraint customer_lifecycle_events_type_check
      check (event_type in (
        'customer_welcome',
        'thank_you',
        'review_reminder',
        'abandoned_cart',
        'win_back',
        'loyalty_campaign'
      ));
  end if;
end $$;

create unique index if not exists customer_lifecycle_events_unique_order_event_idx
on public.customer_lifecycle_events(workspace_id, store_id, order_id, event_type);

create index if not exists customer_lifecycle_events_store_created_idx
on public.customer_lifecycle_events(workspace_id, store_id, created_at desc);

create index if not exists customer_lifecycle_events_due_idx
on public.customer_lifecycle_events(workspace_id, store_id, scheduled_for)
where processed_at is null;

create unique index if not exists customer_lifecycle_events_customer_welcome_idx
on public.customer_lifecycle_events(workspace_id, store_id, customer_id, event_type)
where event_type = 'customer_welcome' and customer_id is not null;

alter table public.customer_lifecycle_events enable row level security;

drop policy if exists "workspace members read customer lifecycle events" on public.customer_lifecycle_events;
create policy "workspace members read customer lifecycle events"
on public.customer_lifecycle_events
for select
to authenticated
using (public.can_access_workspace(workspace_id));

drop policy if exists "workspace editors write customer lifecycle events" on public.customer_lifecycle_events;
create policy "workspace editors write customer lifecycle events"
on public.customer_lifecycle_events
for all
to authenticated
using (public.workspace_can_edit(workspace_id))
with check (public.workspace_can_edit(workspace_id));

drop policy if exists "service role can manage customer lifecycle events" on public.customer_lifecycle_events;
create policy "service role can manage customer lifecycle events"
on public.customer_lifecycle_events
for all
to service_role
using (true)
with check (true);
