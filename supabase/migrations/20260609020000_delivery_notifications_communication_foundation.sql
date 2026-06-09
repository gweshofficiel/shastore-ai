-- Delivery notifications and communication center foundation.
-- Additive only: delivery-scoped notifications and owner/delivery/system messages.

create table if not exists public.delivery_notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  store_id uuid not null references public.stores(id) on delete cascade,
  delivery_agent_id uuid not null references public.store_delivery_agents(id) on delete cascade,
  order_source text check (order_source is null or order_source in ('orders', 'store_orders')),
  order_id uuid,
  category text not null check (
    category in (
      'new_assignment',
      'assignment_updated',
      'status_change',
      'return_request',
      'return_approved',
      'reschedule_request',
      'cod_collection_pending',
      'cod_settled',
      'performance_update',
      'system_notice'
    )
  ),
  title text not null,
  message text not null,
  status text not null default 'unread' check (status in ('unread', 'read', 'archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.delivery_messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  store_id uuid not null references public.stores(id) on delete cascade,
  delivery_agent_id uuid not null references public.store_delivery_agents(id) on delete cascade,
  order_source text check (order_source is null or order_source in ('orders', 'store_orders')),
  order_id uuid,
  conversation_type text not null default 'owner_delivery' check (conversation_type in ('owner_delivery', 'system_delivery')),
  sender_type text not null check (sender_type in ('owner', 'delivery', 'system')),
  sender_user_id uuid references auth.users(id) on delete set null,
  message text not null,
  status text not null default 'unread' check (status in ('unread', 'read', 'archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists delivery_notifications_agent_status_idx
on public.delivery_notifications(delivery_agent_id, status, created_at desc);

create index if not exists delivery_notifications_store_idx
on public.delivery_notifications(workspace_id, store_id, category, created_at desc);

create index if not exists delivery_messages_agent_idx
on public.delivery_messages(delivery_agent_id, status, created_at desc);

create index if not exists delivery_messages_store_idx
on public.delivery_messages(workspace_id, store_id, delivery_agent_id, created_at desc);

create index if not exists delivery_messages_order_idx
on public.delivery_messages(workspace_id, store_id, order_source, order_id, created_at desc)
where order_id is not null;

create or replace function public.set_delivery_notifications_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.title = nullif(trim(coalesce(new.title, '')), '');
  new.message = nullif(trim(coalesce(new.message, '')), '');

  if new.title is null or new.message is null then
    raise exception 'delivery notification title and message are required';
  end if;

  return new;
end;
$$;

drop trigger if exists delivery_notifications_updated_at on public.delivery_notifications;
create trigger delivery_notifications_updated_at
before insert or update on public.delivery_notifications
for each row execute function public.set_delivery_notifications_updated_at();

create or replace function public.set_delivery_messages_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.message = nullif(trim(coalesce(new.message, '')), '');

  if new.message is null then
    raise exception 'delivery message is required';
  end if;

  return new;
end;
$$;

drop trigger if exists delivery_messages_updated_at on public.delivery_messages;
create trigger delivery_messages_updated_at
before insert or update on public.delivery_messages
for each row execute function public.set_delivery_messages_updated_at();

alter table public.delivery_notifications enable row level security;
alter table public.delivery_messages enable row level security;

drop policy if exists "workspace members read delivery notifications" on public.delivery_notifications;
drop policy if exists "workspace editors write delivery notifications" on public.delivery_notifications;
drop policy if exists "delivery agents read own notifications" on public.delivery_notifications;
drop policy if exists "delivery agents update own notifications" on public.delivery_notifications;
drop policy if exists "workspace members read delivery messages" on public.delivery_messages;
drop policy if exists "workspace editors write delivery messages" on public.delivery_messages;
drop policy if exists "delivery agents read own messages" on public.delivery_messages;
drop policy if exists "delivery agents insert own messages" on public.delivery_messages;
drop policy if exists "delivery agents update own messages" on public.delivery_messages;

create policy "workspace members read delivery notifications"
on public.delivery_notifications for select to authenticated
using (public.can_access_workspace(workspace_id));

create policy "workspace editors write delivery notifications"
on public.delivery_notifications for all to authenticated
using (public.workspace_can_edit(workspace_id))
with check (public.workspace_can_edit(workspace_id));

create policy "delivery agents read own notifications"
on public.delivery_notifications for select to authenticated
using (
  exists (
    select 1
    from public.store_delivery_agents agents
    where agents.id = delivery_notifications.delivery_agent_id
      and agents.store_id = delivery_notifications.store_id
      and agents.status = 'active'
      and agents.metadata->>'auth_user_id' = auth.uid()::text
  )
);

create policy "delivery agents update own notifications"
on public.delivery_notifications for update to authenticated
using (
  exists (
    select 1
    from public.store_delivery_agents agents
    where agents.id = delivery_notifications.delivery_agent_id
      and agents.store_id = delivery_notifications.store_id
      and agents.status = 'active'
      and agents.metadata->>'auth_user_id' = auth.uid()::text
  )
)
with check (
  exists (
    select 1
    from public.store_delivery_agents agents
    where agents.id = delivery_notifications.delivery_agent_id
      and agents.store_id = delivery_notifications.store_id
      and agents.status = 'active'
      and agents.metadata->>'auth_user_id' = auth.uid()::text
  )
);

create policy "workspace members read delivery messages"
on public.delivery_messages for select to authenticated
using (public.can_access_workspace(workspace_id));

create policy "workspace editors write delivery messages"
on public.delivery_messages for all to authenticated
using (public.workspace_can_edit(workspace_id))
with check (public.workspace_can_edit(workspace_id));

create policy "delivery agents read own messages"
on public.delivery_messages for select to authenticated
using (
  exists (
    select 1
    from public.store_delivery_agents agents
    where agents.id = delivery_messages.delivery_agent_id
      and agents.store_id = delivery_messages.store_id
      and agents.status = 'active'
      and agents.metadata->>'auth_user_id' = auth.uid()::text
  )
);

create policy "delivery agents insert own messages"
on public.delivery_messages for insert to authenticated
with check (
  sender_type = 'delivery'
  and exists (
    select 1
    from public.store_delivery_agents agents
    where agents.id = delivery_messages.delivery_agent_id
      and agents.store_id = delivery_messages.store_id
      and agents.status = 'active'
      and agents.metadata->>'auth_user_id' = auth.uid()::text
  )
);

create policy "delivery agents update own messages"
on public.delivery_messages for update to authenticated
using (
  exists (
    select 1
    from public.store_delivery_agents agents
    where agents.id = delivery_messages.delivery_agent_id
      and agents.store_id = delivery_messages.store_id
      and agents.status = 'active'
      and agents.metadata->>'auth_user_id' = auth.uid()::text
  )
)
with check (
  exists (
    select 1
    from public.store_delivery_agents agents
    where agents.id = delivery_messages.delivery_agent_id
      and agents.store_id = delivery_messages.store_id
      and agents.status = 'active'
      and agents.metadata->>'auth_user_id' = auth.uid()::text
  )
);
