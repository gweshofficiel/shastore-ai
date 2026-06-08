-- Delivery returns and failed deliveries foundation.
-- Additive only: delivery-agent failure reports, return workflow, and reschedule placeholders.

create table if not exists public.delivery_returns (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  store_id uuid not null references public.stores(id) on delete cascade,
  order_id uuid not null,
  order_source text not null check (order_source in ('orders', 'store_orders')),
  assignment_id uuid not null references public.delivery_assignments(id) on delete cascade,
  delivery_agent_id uuid not null references public.store_delivery_agents(id) on delete cascade,
  reason text not null check (
    reason in (
      'customer_refused',
      'customer_unreachable',
      'wrong_address',
      'reschedule_requested'
    )
  ),
  status text not null default 'return_in_progress' check (
    status in (
      'customer_refused',
      'customer_unreachable',
      'wrong_address',
      'reschedule_requested',
      'return_in_progress',
      'returned_to_store',
      'return_completed'
    )
  ),
  requested_delivery_date_placeholder timestamptz,
  approved_delivery_date_placeholder timestamptz,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists delivery_returns_assignment_unique_idx
on public.delivery_returns(assignment_id);

create index if not exists delivery_returns_agent_idx
on public.delivery_returns(delivery_agent_id, status, created_at desc);

create index if not exists delivery_returns_workspace_store_idx
on public.delivery_returns(workspace_id, store_id, status, created_at desc);

create or replace function public.set_delivery_returns_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.notes = nullif(trim(coalesce(new.notes, '')), '');
  return new;
end;
$$;

drop trigger if exists delivery_returns_updated_at on public.delivery_returns;
create trigger delivery_returns_updated_at
before insert or update on public.delivery_returns
for each row execute function public.set_delivery_returns_updated_at();

alter table public.delivery_returns enable row level security;

drop policy if exists "workspace members read delivery returns" on public.delivery_returns;
drop policy if exists "workspace editors write delivery returns" on public.delivery_returns;
drop policy if exists "delivery agents read own returns" on public.delivery_returns;
drop policy if exists "delivery agents report own returns" on public.delivery_returns;

create policy "workspace members read delivery returns"
on public.delivery_returns for select to authenticated
using (public.can_access_workspace(workspace_id));

create policy "workspace editors write delivery returns"
on public.delivery_returns for all to authenticated
using (public.workspace_can_edit(workspace_id))
with check (public.workspace_can_edit(workspace_id));

create policy "delivery agents read own returns"
on public.delivery_returns for select to authenticated
using (
  exists (
    select 1
    from public.store_delivery_agents agents
    where agents.id = delivery_returns.delivery_agent_id
      and agents.store_id = delivery_returns.store_id
      and agents.status = 'active'
      and agents.metadata->>'auth_user_id' = auth.uid()::text
  )
);

create policy "delivery agents report own returns"
on public.delivery_returns for insert to authenticated
with check (
  exists (
    select 1
    from public.delivery_assignments assignments
    join public.store_delivery_agents agents
      on agents.id = assignments.delivery_agent_id
    where assignments.id = delivery_returns.assignment_id
      and assignments.delivery_agent_id = delivery_returns.delivery_agent_id
      and assignments.store_id = delivery_returns.store_id
      and assignments.status in ('assigned', 'accepted', 'picked_up')
      and agents.status = 'active'
      and agents.metadata->>'auth_user_id' = auth.uid()::text
  )
);

alter table public.store_delivery_events
  drop constraint if exists store_delivery_events_event_type_check;

alter table public.store_delivery_events
  add constraint store_delivery_events_event_type_check
  check (
    event_type in (
      'delivery_assigned',
      'delivery_agent_changed',
      'delivery_status_changed',
      'cash_collected',
      'cash_settled',
      'cash_dispute_opened',
      'delivery_failed',
      'customer_refused',
      'wrong_address',
      'return_started',
      'returned_to_store',
      'return_completed',
      'reschedule_requested',
      'reschedule_approved'
    )
  );
