-- Seller order activity timeline foundation.
-- Additive only: preserves checkout, tracking, fulfillment, and payment-disabled flow.

create extension if not exists "pgcrypto";

create table if not exists public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null,
  order_source text not null default 'orders',
  store_id uuid not null references public.stores(id) on delete cascade,
  workspace_id uuid,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  previous_value text,
  new_value text,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table if exists public.order_events
  add column if not exists order_source text not null default 'orders',
  add column if not exists workspace_id uuid,
  add column if not exists actor_user_id uuid references auth.users(id) on delete set null,
  add column if not exists previous_value text,
  add column if not exists new_value text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists order_events_order_created_idx
on public.order_events(order_id, order_source, created_at desc);

create index if not exists order_events_workspace_created_idx
on public.order_events(workspace_id, created_at desc);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'order_events_type_check'
      and conrelid = 'public.order_events'::regclass
  ) then
    alter table public.order_events
      add constraint order_events_type_check
      check (
        event_type in (
          'order_created',
          'status_changed',
          'fulfillment_changed',
          'payment_status_changed',
          'seller_note_updated'
        )
      );
  end if;
end $$;

alter table public.order_events enable row level security;

drop policy if exists "workspace members read order events" on public.order_events;
drop policy if exists "workspace managers insert order events" on public.order_events;

create policy "workspace members read order events"
on public.order_events
for select
to authenticated
using (
  public.can_access_workspace(workspace_id)
);

create policy "workspace managers insert order events"
on public.order_events
for insert
to authenticated
with check (
  public.workspace_can_edit(workspace_id)
);
