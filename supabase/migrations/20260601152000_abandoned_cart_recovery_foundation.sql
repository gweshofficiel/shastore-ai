-- Abandoned cart recovery foundation.
-- Additive only: store-scoped cart snapshots and recovery email template support.

create table if not exists public.store_abandoned_carts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  store_id uuid not null references public.stores(id) on delete cascade,
  session_id text not null,
  customer_email text,
  customer_phone text,
  currency text not null default 'USD',
  items jsonb not null default '[]'::jsonb,
  items_count integer not null default 0 check (items_count >= 0),
  estimated_total numeric(12, 2) not null default 0 check (estimated_total >= 0),
  recovery_status text not null default 'pending' check (recovery_status in ('pending', 'email_sent', 'recovered', 'expired')),
  last_activity_at timestamptz not null default now(),
  abandoned_at timestamptz,
  recovery_email_sent_at timestamptz,
  recovered_at timestamptz,
  recovered_order_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, session_id)
);

create index if not exists store_abandoned_carts_workspace_store_idx
on public.store_abandoned_carts(workspace_id, store_id, last_activity_at desc);

create index if not exists store_abandoned_carts_status_idx
on public.store_abandoned_carts(workspace_id, store_id, recovery_status, last_activity_at desc);

create or replace function public.set_store_abandoned_carts_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.customer_email = nullif(lower(trim(coalesce(new.customer_email, ''))), '');
  new.customer_phone = nullif(trim(coalesce(new.customer_phone, '')), '');
  new.currency = upper(nullif(trim(coalesce(new.currency, '')), ''));
  if new.currency is null then
    new.currency = 'USD';
  end if;
  return new;
end;
$$;

drop trigger if exists store_abandoned_carts_updated_at on public.store_abandoned_carts;
create trigger store_abandoned_carts_updated_at
before insert or update on public.store_abandoned_carts
for each row execute function public.set_store_abandoned_carts_updated_at();

alter table public.store_abandoned_carts enable row level security;

drop policy if exists "workspace members read abandoned carts" on public.store_abandoned_carts;
create policy "workspace members read abandoned carts"
on public.store_abandoned_carts
for select
to authenticated
using (public.can_access_workspace(workspace_id));

drop policy if exists "workspace editors write abandoned carts" on public.store_abandoned_carts;
create policy "workspace editors write abandoned carts"
on public.store_abandoned_carts
for all
to authenticated
using (public.workspace_can_edit(workspace_id))
with check (public.workspace_can_edit(workspace_id));

drop policy if exists "service role can manage abandoned carts" on public.store_abandoned_carts;
create policy "service role can manage abandoned carts"
on public.store_abandoned_carts
for all
to service_role
using (true)
with check (true);

alter table if exists public.store_email_settings
  add column if not exists enable_abandoned_cart_recovery boolean not null default true;

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
      'low_stock_alert',
      'order_confirmation',
      'order_status_update',
      'review_reminder',
      'review_request',
      'thank_you'
    ));
end $$;
