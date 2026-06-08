-- COD collection foundation.
-- Additive only: store-scoped cash collection tracking for delivered assignments.

create table if not exists public.cod_collections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  store_id uuid not null references public.stores(id) on delete cascade,
  order_id uuid not null,
  order_source text not null check (order_source in ('orders', 'store_orders')),
  assignment_id uuid not null references public.delivery_assignments(id) on delete cascade,
  delivery_agent_id uuid not null references public.store_delivery_agents(id) on delete cascade,
  amount numeric(12, 2) not null default 0,
  currency text not null default 'USD',
  status text not null default 'pending_collection' check (status in ('pending_collection', 'collected', 'settled_to_store', 'disputed')),
  collected_at timestamptz,
  settled_at timestamptz,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists cod_collections_assignment_unique_idx
on public.cod_collections(assignment_id);

create index if not exists cod_collections_agent_idx
on public.cod_collections(delivery_agent_id, status, collected_at desc);

create index if not exists cod_collections_workspace_store_idx
on public.cod_collections(workspace_id, store_id, status, created_at desc);

create or replace function public.set_cod_collections_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.currency = upper(nullif(trim(coalesce(new.currency, '')), ''));
  new.notes = nullif(trim(coalesce(new.notes, '')), '');

  if new.currency is null then
    new.currency = 'USD';
  end if;

  return new;
end;
$$;

drop trigger if exists cod_collections_updated_at on public.cod_collections;
create trigger cod_collections_updated_at
before insert or update on public.cod_collections
for each row execute function public.set_cod_collections_updated_at();

alter table public.cod_collections enable row level security;

drop policy if exists "workspace members read cod collections" on public.cod_collections;
drop policy if exists "workspace editors write cod collections" on public.cod_collections;
drop policy if exists "delivery agents read own cod collections" on public.cod_collections;
drop policy if exists "delivery agents insert own cod collections" on public.cod_collections;
drop policy if exists "delivery agents collect own cod collections" on public.cod_collections;

create policy "workspace members read cod collections"
on public.cod_collections for select to authenticated
using (public.can_access_workspace(workspace_id));

create policy "workspace editors write cod collections"
on public.cod_collections for all to authenticated
using (public.workspace_can_edit(workspace_id))
with check (public.workspace_can_edit(workspace_id));

create policy "delivery agents read own cod collections"
on public.cod_collections for select to authenticated
using (
  exists (
    select 1
    from public.store_delivery_agents agents
    where agents.id = cod_collections.delivery_agent_id
      and agents.store_id = cod_collections.store_id
      and agents.status = 'active'
      and agents.metadata->>'auth_user_id' = auth.uid()::text
  )
);

create policy "delivery agents insert own cod collections"
on public.cod_collections for insert to authenticated
with check (
  status in ('pending_collection', 'collected')
  and exists (
    select 1
    from public.delivery_assignments assignments
    join public.store_delivery_agents agents
      on agents.id = assignments.delivery_agent_id
    where assignments.id = cod_collections.assignment_id
      and assignments.delivery_agent_id = cod_collections.delivery_agent_id
      and assignments.store_id = cod_collections.store_id
      and assignments.status = 'delivered'
      and agents.status = 'active'
      and agents.metadata->>'auth_user_id' = auth.uid()::text
  )
);

create policy "delivery agents collect own cod collections"
on public.cod_collections for update to authenticated
using (
  status in ('pending_collection', 'collected')
  and exists (
    select 1
    from public.store_delivery_agents agents
    where agents.id = cod_collections.delivery_agent_id
      and agents.store_id = cod_collections.store_id
      and agents.status = 'active'
      and agents.metadata->>'auth_user_id' = auth.uid()::text
  )
)
with check (
  status in ('pending_collection', 'collected')
  and exists (
    select 1
    from public.store_delivery_agents agents
    where agents.id = cod_collections.delivery_agent_id
      and agents.store_id = cod_collections.store_id
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
      'cash_dispute_opened'
    )
  );
