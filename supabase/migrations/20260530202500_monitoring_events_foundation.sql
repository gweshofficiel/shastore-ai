create extension if not exists "pgcrypto";

create table if not exists public.monitoring_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid null,
  store_id uuid null,
  user_id uuid null references auth.users(id) on delete set null,
  event_type text not null,
  event_status text not null default 'success'
    check (event_status in ('success', 'failed', 'warning', 'pending', 'info')),
  entity_type text not null,
  entity_id uuid null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists monitoring_events_workspace_created_idx
on public.monitoring_events(workspace_id, created_at desc);

create index if not exists monitoring_events_store_created_idx
on public.monitoring_events(store_id, created_at desc);

create index if not exists monitoring_events_type_status_created_idx
on public.monitoring_events(event_type, event_status, created_at desc);

create index if not exists monitoring_events_retention_created_idx
on public.monitoring_events(created_at);

alter table public.monitoring_events enable row level security;

drop policy if exists "workspace members read monitoring events" on public.monitoring_events;
drop policy if exists "store owners read monitoring events" on public.monitoring_events;
drop policy if exists "platform admins read monitoring events" on public.monitoring_events;
drop policy if exists "service role inserts monitoring events" on public.monitoring_events;

create policy "workspace members read monitoring events"
on public.monitoring_events
for select
to authenticated
using (
  workspace_id is not null
  and (
    workspace_id = auth.uid()
    or public.can_access_workspace(workspace_id)
  )
);

create policy "store owners read monitoring events"
on public.monitoring_events
for select
to authenticated
using (
  store_id is not null
  and exists (
    select 1
    from public.stores s
    where s.id = monitoring_events.store_id
      and (s.owner_user_id = auth.uid() or s.user_id = auth.uid())
  )
);

create policy "platform admins read monitoring events"
on public.monitoring_events
for select
to authenticated
using (public.shastore_is_admin());

create policy "service role inserts monitoring events"
on public.monitoring_events
for insert
to service_role
with check (true);

grant select on public.monitoring_events to authenticated;
grant insert on public.monitoring_events to service_role;

create or replace function public.record_store_customer_monitoring_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.monitoring_events (
    workspace_id,
    store_id,
    event_type,
    event_status,
    entity_type,
    entity_id,
    metadata
  )
  values (
    new.workspace_id,
    new.store_id,
    case when tg_op = 'INSERT' then 'customer.created' else 'customer.updated' end,
    'success',
    'customer',
    new.id,
    jsonb_build_object(
      'status', new.status,
      'source', 'store_customers_trigger'
    )
  );

  return new;
exception
  when others then
    return new;
end;
$$;

drop trigger if exists store_customers_monitoring_events on public.store_customers;
create trigger store_customers_monitoring_events
after insert or update on public.store_customers
for each row execute function public.record_store_customer_monitoring_event();
