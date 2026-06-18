-- MP-16: Marketplace moderation runtime foundation.
-- Additive moderation metadata only. No public catalog, purchase, or payouts.

create table if not exists public.marketplace_moderation_events (
  id uuid primary key default gen_random_uuid(),
  marketplace_item_id uuid not null references public.marketplace_items(id) on delete restrict,
  creator_account_id uuid null references public.marketplace_creator_accounts(id) on delete restrict,
  moderated_by uuid null,
  moderation_action text not null,
  previous_status text not null,
  new_status text not null,
  moderation_reason text null,
  moderation_note text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketplace_moderation_events_action_check
    check (moderation_action in ('approve', 'reject', 'request_changes', 'archive')),
  constraint marketplace_moderation_events_previous_status_check
    check (previous_status in ('draft', 'pending_review', 'approved', 'rejected', 'archived')),
  constraint marketplace_moderation_events_new_status_check
    check (new_status in ('draft', 'pending_review', 'approved', 'rejected', 'archived')),
  constraint marketplace_moderation_events_note_check
    check (moderation_note is null or char_length(moderation_note) <= 2000),
  constraint marketplace_moderation_events_reason_check
    check (moderation_reason is null or char_length(moderation_reason) <= 500)
);

create index if not exists marketplace_moderation_events_item_created_idx
  on public.marketplace_moderation_events(marketplace_item_id, created_at desc);

create index if not exists marketplace_moderation_events_action_created_idx
  on public.marketplace_moderation_events(moderation_action, created_at desc);

alter table public.marketplace_moderation_events enable row level security;

drop policy if exists "service role can manage marketplace moderation events" on public.marketplace_moderation_events;
create policy "service role can manage marketplace moderation events"
on public.marketplace_moderation_events
for all
to service_role
using (true)
with check (true);

create or replace function public.marketplace_moderation_events_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists marketplace_moderation_events_updated_at on public.marketplace_moderation_events;
create trigger marketplace_moderation_events_updated_at
before update on public.marketplace_moderation_events
for each row
execute function public.marketplace_moderation_events_set_updated_at();

create or replace function public.marketplace_moderation_events_guard_metadata()
returns trigger
language plpgsql
as $$
declare
  metadata_text text;
begin
  if new.moderation_action not in ('approve', 'reject', 'request_changes', 'archive') then
    raise exception 'Invalid marketplace moderation_action: %', new.moderation_action;
  end if;

  metadata_text := lower(new.metadata::text);

  if metadata_text like '%api_key%' or metadata_text like '%apikey%' then
    raise exception 'Marketplace moderation metadata must not contain API secrets';
  end if;

  if metadata_text like '%password%' or metadata_text like '%secret%' or metadata_text like '%token%' then
    raise exception 'Marketplace moderation metadata must not contain secrets';
  end if;

  return new;
end;
$$;

drop trigger if exists marketplace_moderation_events_guard_metadata on public.marketplace_moderation_events;
create trigger marketplace_moderation_events_guard_metadata
before insert or update of metadata, moderation_action
on public.marketplace_moderation_events
for each row
execute function public.marketplace_moderation_events_guard_metadata();

alter table public.marketplace_items
  add column if not exists moderated_by uuid null,
  add column if not exists moderated_at timestamptz null,
  add column if not exists moderation_action text null,
  add column if not exists moderation_reason text null,
  add column if not exists moderation_note text null,
  add column if not exists moderation_updated_at timestamptz null;

alter table public.marketplace_items
  drop constraint if exists marketplace_items_moderation_action_check;

alter table public.marketplace_items
  add constraint marketplace_items_moderation_action_check
  check (
    moderation_action is null
    or moderation_action in ('approve', 'reject', 'request_changes', 'archive')
  );

create index if not exists marketplace_items_moderation_action_idx
  on public.marketplace_items(moderation_action, moderation_updated_at desc nulls last)
  where moderation_action is not null;
