-- Shipping tracking and delivery proof foundation.
-- Additive only: preserves existing order data, RLS, ownership, and workspace isolation.

alter table if exists public.orders
  add column if not exists carrier_name text,
  add column if not exists tracking_number text,
  add column if not exists tracking_url text,
  add column if not exists shipped_at timestamptz,
  add column if not exists delivered_at timestamptz,
  add column if not exists delivery_notes text,
  add column if not exists proof_of_delivery text;

alter table if exists public.store_orders
  add column if not exists carrier_name text,
  add column if not exists tracking_number text,
  add column if not exists tracking_url text,
  add column if not exists shipped_at timestamptz,
  add column if not exists delivered_at timestamptz,
  add column if not exists delivery_notes text,
  add column if not exists proof_of_delivery text;

do $$
declare
  constraint_row record;
begin
  if to_regclass('public.order_events') is null then
    return;
  end if;

  for constraint_row in
    select c.conname
    from pg_constraint c
    where c.conrelid = 'public.order_events'::regclass
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%event_type%'
  loop
    execute format('alter table public.order_events drop constraint if exists %I', constraint_row.conname);
  end loop;

  alter table public.order_events
    add constraint order_events_type_check
    check (
      event_type in (
        'order_created',
        'status_changed',
        'fulfillment_changed',
        'shipping_tracking_updated',
        'payment_status_changed',
        'seller_note_updated'
      )
    )
    not valid;
end $$;
