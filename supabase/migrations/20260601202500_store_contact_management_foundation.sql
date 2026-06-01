-- Storefront contact page management foundation.
-- Additive only: contact page message copy plus store-scoped contact submissions.

alter table if exists public.stores
  add column if not exists contact_message text;

create table if not exists public.store_contact_messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  store_id uuid not null references public.stores(id) on delete cascade,
  customer_name text not null check (char_length(trim(customer_name)) between 1 and 160),
  customer_email text not null check (char_length(trim(customer_email)) between 3 and 180),
  subject text not null check (char_length(trim(subject)) between 2 and 220),
  message text not null check (char_length(trim(message)) between 10 and 4000),
  status text not null default 'new'
    check (status in ('new', 'read', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists store_contact_messages_store_status_idx
on public.store_contact_messages(workspace_id, store_id, status, created_at desc);

create index if not exists store_contact_messages_store_created_idx
on public.store_contact_messages(store_id, created_at desc);

alter table public.store_contact_messages enable row level security;

drop policy if exists "workspace members read contact messages" on public.store_contact_messages;
drop policy if exists "workspace editors manage contact messages" on public.store_contact_messages;
drop policy if exists "public inserts contact messages for published stores" on public.store_contact_messages;

create policy "workspace members read contact messages"
on public.store_contact_messages
for select
to authenticated
using (public.can_access_workspace(workspace_id));

create policy "workspace editors manage contact messages"
on public.store_contact_messages
for all
to authenticated
using (public.workspace_can_edit(workspace_id))
with check (public.workspace_can_edit(workspace_id));

create policy "public inserts contact messages for published stores"
on public.store_contact_messages
for insert
to anon, authenticated
with check (
  exists (
    select 1
    from public.stores stores
    left join public.published_stores published
      on published.store_id = stores.id
    where stores.id = store_contact_messages.store_id
      and stores.workspace_id = store_contact_messages.workspace_id
      and stores.status = 'published'
      and coalesce(published.status, 'published') = 'published'
      and coalesce(published.visibility, 'public') = 'public'
  )
);
