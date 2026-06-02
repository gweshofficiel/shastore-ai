-- Store support tickets foundation.
-- Additive only: customer-store support tickets, conversation messages, and ticket timeline events.

create table if not exists public.store_support_tickets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  store_id uuid not null references public.stores(id) on delete cascade,
  customer_id uuid references public.store_customers(id) on delete set null,
  assigned_user_id uuid references auth.users(id) on delete set null,
  ticket_number text not null,
  customer_name text,
  customer_phone text,
  customer_email text,
  subject text not null,
  category text not null check (category in ('Order Issue', 'Delivery Issue', 'Refund Request', 'Return Request', 'Product Question', 'Technical Issue', 'Other')),
  priority text not null default 'Medium' check (priority in ('Low', 'Medium', 'High', 'Urgent')),
  status text not null default 'Open' check (status in ('Open', 'In Progress', 'Waiting Customer', 'Resolved', 'Closed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.store_support_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  store_id uuid not null references public.stores(id) on delete cascade,
  ticket_id uuid not null references public.store_support_tickets(id) on delete cascade,
  sender_type text not null check (sender_type in ('customer', 'staff')),
  sender_user_id uuid references auth.users(id) on delete set null,
  customer_name text,
  customer_phone text,
  customer_email text,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.store_support_ticket_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  store_id uuid not null references public.stores(id) on delete cascade,
  ticket_id uuid not null references public.store_support_tickets(id) on delete cascade,
  actor_type text not null check (actor_type in ('customer', 'staff', 'system')),
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null check (event_type in ('ticket_created', 'ticket_replied', 'status_changed', 'assigned')),
  previous_value text,
  new_value text,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists store_support_tickets_store_number_unique_idx
on public.store_support_tickets(store_id, ticket_number);

create index if not exists store_support_tickets_workspace_store_status_idx
on public.store_support_tickets(workspace_id, store_id, status, updated_at desc);

create index if not exists store_support_tickets_customer_phone_idx
on public.store_support_tickets(workspace_id, store_id, customer_phone, updated_at desc)
where customer_phone is not null;

create index if not exists store_support_ticket_messages_ticket_idx
on public.store_support_ticket_messages(workspace_id, store_id, ticket_id, created_at asc);

create index if not exists store_support_ticket_events_ticket_idx
on public.store_support_ticket_events(workspace_id, store_id, ticket_id, created_at desc);

create or replace function public.set_store_support_tickets_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.customer_phone = nullif(trim(coalesce(new.customer_phone, '')), '');
  new.customer_email = nullif(lower(trim(coalesce(new.customer_email, ''))), '');
  new.subject = trim(new.subject);
  return new;
end;
$$;

drop trigger if exists store_support_tickets_updated_at on public.store_support_tickets;
create trigger store_support_tickets_updated_at
before insert or update on public.store_support_tickets
for each row execute function public.set_store_support_tickets_updated_at();

alter table public.store_support_tickets enable row level security;
alter table public.store_support_ticket_messages enable row level security;
alter table public.store_support_ticket_events enable row level security;

drop policy if exists "workspace members read store support tickets" on public.store_support_tickets;
drop policy if exists "workspace support staff write store support tickets" on public.store_support_tickets;
drop policy if exists "workspace members read store support messages" on public.store_support_ticket_messages;
drop policy if exists "workspace support staff write store support messages" on public.store_support_ticket_messages;
drop policy if exists "workspace members read store support events" on public.store_support_ticket_events;
drop policy if exists "workspace support staff write store support events" on public.store_support_ticket_events;

create policy "workspace members read store support tickets"
on public.store_support_tickets for select to authenticated
using (public.can_access_workspace(workspace_id));

create policy "workspace support staff write store support tickets"
on public.store_support_tickets for all to authenticated
using (public.workspace_can_edit(workspace_id))
with check (public.workspace_can_edit(workspace_id));

create policy "workspace members read store support messages"
on public.store_support_ticket_messages for select to authenticated
using (public.can_access_workspace(workspace_id));

create policy "workspace support staff write store support messages"
on public.store_support_ticket_messages for all to authenticated
using (public.workspace_can_edit(workspace_id))
with check (public.workspace_can_edit(workspace_id));

create policy "workspace members read store support events"
on public.store_support_ticket_events for select to authenticated
using (public.can_access_workspace(workspace_id));

create policy "workspace support staff write store support events"
on public.store_support_ticket_events for all to authenticated
using (public.workspace_can_edit(workspace_id))
with check (public.workspace_can_edit(workspace_id));
