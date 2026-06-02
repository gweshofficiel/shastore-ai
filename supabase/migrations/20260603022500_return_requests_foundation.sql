-- Return requests foundation.
-- Additive only: store-scoped customer return requests and order timeline events.

create table if not exists public.store_return_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  store_id uuid not null references public.stores(id) on delete cascade,
  order_source text not null check (order_source in ('orders', 'store_orders')),
  order_id uuid not null,
  customer_name text,
  customer_phone text,
  customer_email text,
  reason text not null,
  notes text,
  status text not null default 'requested' check (status in ('requested', 'approved', 'rejected', 'received', 'closed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists store_return_requests_order_unique_idx
on public.store_return_requests(store_id, order_source, order_id);

create index if not exists store_return_requests_workspace_store_status_idx
on public.store_return_requests(workspace_id, store_id, status, created_at desc);

create index if not exists store_return_requests_customer_phone_idx
on public.store_return_requests(workspace_id, store_id, customer_phone, created_at desc)
where customer_phone is not null;

create or replace function public.set_store_return_requests_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.customer_phone = nullif(trim(coalesce(new.customer_phone, '')), '');
  new.customer_email = nullif(lower(trim(coalesce(new.customer_email, ''))), '');
  new.reason = trim(new.reason);
  new.notes = nullif(trim(coalesce(new.notes, '')), '');
  return new;
end;
$$;

drop trigger if exists store_return_requests_updated_at on public.store_return_requests;
create trigger store_return_requests_updated_at
before insert or update on public.store_return_requests
for each row execute function public.set_store_return_requests_updated_at();

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
        'seller_note_updated',
        'return_request_created',
        'return_status_changed'
      )
    )
    not valid;
end $$;

alter table public.store_return_requests enable row level security;

drop policy if exists "workspace members read return requests" on public.store_return_requests;
drop policy if exists "workspace editors write return requests" on public.store_return_requests;

create policy "workspace members read return requests"
on public.store_return_requests for select to authenticated
using (public.can_access_workspace(workspace_id));

create policy "workspace editors write return requests"
on public.store_return_requests for all to authenticated
using (public.workspace_can_edit(workspace_id))
with check (public.workspace_can_edit(workspace_id));
