-- Popups and announcements foundation.
-- Additive only: store-scoped announcement bars and storefront popup settings.

create table if not exists public.store_marketing_messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  store_id uuid not null references public.stores(id) on delete cascade,
  message_type text not null check (message_type in ('announcement_bar', 'discount_popup', 'newsletter_popup', 'exit_intent_popup')),
  title text not null,
  message text not null,
  button_text text,
  button_link text,
  status text not null default 'draft' check (status in ('draft', 'active', 'disabled')),
  starts_at timestamptz,
  ends_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists store_marketing_messages_workspace_store_idx
on public.store_marketing_messages(workspace_id, store_id, status, message_type, created_at desc);

create index if not exists store_marketing_messages_active_window_idx
on public.store_marketing_messages(store_id, status, starts_at, ends_at);

create or replace function public.set_store_marketing_messages_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.title = trim(new.title);
  new.message = trim(new.message);
  new.button_text = nullif(trim(coalesce(new.button_text, '')), '');
  new.button_link = nullif(trim(coalesce(new.button_link, '')), '');
  return new;
end;
$$;

drop trigger if exists store_marketing_messages_updated_at on public.store_marketing_messages;
create trigger store_marketing_messages_updated_at
before insert or update on public.store_marketing_messages
for each row execute function public.set_store_marketing_messages_updated_at();

alter table public.store_marketing_messages enable row level security;

drop policy if exists "workspace members read marketing messages" on public.store_marketing_messages;
drop policy if exists "workspace editors write marketing messages" on public.store_marketing_messages;

create policy "workspace members read marketing messages"
on public.store_marketing_messages for select to authenticated
using (public.can_access_workspace(workspace_id));

create policy "workspace editors write marketing messages"
on public.store_marketing_messages for all to authenticated
using (public.workspace_can_edit(workspace_id))
with check (public.workspace_can_edit(workspace_id));
