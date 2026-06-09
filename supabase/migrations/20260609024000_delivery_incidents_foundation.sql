-- Delivery incidents and violation management foundation.
-- Additive only: delivery-scoped incident records and incident timeline events.

create table if not exists public.delivery_incidents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  store_id uuid not null references public.stores(id) on delete cascade,
  delivery_agent_id uuid not null references public.store_delivery_agents(id) on delete cascade,
  order_source text check (order_source is null or order_source in ('orders', 'store_orders')),
  order_id uuid,
  category text not null check (
    category in (
      'late_delivery',
      'customer_complaint',
      'owner_complaint',
      'cod_dispute',
      'wrong_delivery',
      'missing_item',
      'proof_failure',
      'vehicle_problem',
      'policy_violation',
      'other'
    )
  ),
  description text not null,
  status text not null default 'open' check (
    status in ('open', 'under_review', 'resolved', 'rejected', 'escalated', 'closed')
  ),
  priority text not null default 'medium' check (priority in ('minor', 'medium', 'major', 'critical')),
  reported_by_type text not null default 'delivery' check (reported_by_type in ('delivery', 'owner', 'system')),
  reported_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.delivery_incident_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  store_id uuid not null references public.stores(id) on delete cascade,
  delivery_agent_id uuid not null references public.store_delivery_agents(id) on delete cascade,
  incident_id uuid not null references public.delivery_incidents(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null check (
    event_type in ('incident_created', 'incident_updated', 'incident_resolved', 'incident_escalated')
  ),
  previous_status text,
  new_status text,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists delivery_incidents_agent_status_idx
on public.delivery_incidents(workspace_id, store_id, delivery_agent_id, status, created_at desc);

create index if not exists delivery_incidents_store_status_idx
on public.delivery_incidents(workspace_id, store_id, status, priority, created_at desc);

create index if not exists delivery_incidents_order_idx
on public.delivery_incidents(workspace_id, store_id, order_source, order_id, created_at desc)
where order_id is not null;

create index if not exists delivery_incident_events_incident_idx
on public.delivery_incident_events(incident_id, created_at desc);

create index if not exists delivery_incident_events_agent_idx
on public.delivery_incident_events(workspace_id, store_id, delivery_agent_id, created_at desc);

create or replace function public.set_delivery_incidents_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.description = nullif(trim(coalesce(new.description, '')), '');

  if new.description is null then
    raise exception 'delivery incident description is required';
  end if;

  return new;
end;
$$;

drop trigger if exists delivery_incidents_updated_at on public.delivery_incidents;
create trigger delivery_incidents_updated_at
before insert or update on public.delivery_incidents
for each row execute function public.set_delivery_incidents_updated_at();

alter table public.delivery_incidents enable row level security;
alter table public.delivery_incident_events enable row level security;

drop policy if exists "workspace members read delivery incidents" on public.delivery_incidents;
drop policy if exists "workspace editors write delivery incidents" on public.delivery_incidents;
drop policy if exists "delivery agents read own incidents" on public.delivery_incidents;
drop policy if exists "delivery agents create own incidents" on public.delivery_incidents;
drop policy if exists "workspace members read delivery incident events" on public.delivery_incident_events;
drop policy if exists "workspace editors write delivery incident events" on public.delivery_incident_events;
drop policy if exists "delivery agents read own incident events" on public.delivery_incident_events;

create policy "workspace members read delivery incidents"
on public.delivery_incidents for select to authenticated
using (public.can_access_workspace(workspace_id));

create policy "workspace editors write delivery incidents"
on public.delivery_incidents for all to authenticated
using (public.workspace_can_edit(workspace_id))
with check (public.workspace_can_edit(workspace_id));

create policy "delivery agents read own incidents"
on public.delivery_incidents for select to authenticated
using (
  exists (
    select 1
    from public.store_delivery_agents agents
    where agents.id = delivery_incidents.delivery_agent_id
      and agents.store_id = delivery_incidents.store_id
      and agents.metadata->>'auth_user_id' = auth.uid()::text
  )
);

create policy "delivery agents create own incidents"
on public.delivery_incidents for insert to authenticated
with check (
  reported_by_type = 'delivery'
  and status = 'open'
  and exists (
    select 1
    from public.store_delivery_agents agents
    where agents.id = delivery_incidents.delivery_agent_id
      and agents.store_id = delivery_incidents.store_id
      and agents.status = 'active'
      and agents.metadata->>'auth_user_id' = auth.uid()::text
  )
);

create policy "workspace members read delivery incident events"
on public.delivery_incident_events for select to authenticated
using (public.can_access_workspace(workspace_id));

create policy "workspace editors write delivery incident events"
on public.delivery_incident_events for all to authenticated
using (public.workspace_can_edit(workspace_id))
with check (public.workspace_can_edit(workspace_id));

create policy "delivery agents read own incident events"
on public.delivery_incident_events for select to authenticated
using (
  exists (
    select 1
    from public.store_delivery_agents agents
    where agents.id = delivery_incident_events.delivery_agent_id
      and agents.store_id = delivery_incident_events.store_id
      and agents.metadata->>'auth_user_id' = auth.uid()::text
  )
);
