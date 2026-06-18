-- MP-27: Marketplace analytics runtime foundation.
-- Additive analytics event tracking and read models only. No subscription billing coupling.

create table if not exists public.marketplace_analytics_events (
  id uuid primary key default gen_random_uuid(),
  marketplace_item_id uuid null references public.marketplace_items(id) on delete set null,
  creator_account_id uuid null references public.marketplace_creator_accounts(id) on delete set null,
  event_type text not null,
  event_source text not null default 'marketplace_analytics_runtime',
  account_id uuid null references auth.users(id) on delete set null,
  store_id uuid null references public.stores(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint marketplace_analytics_events_event_type_check
    check (event_type in (
      'view',
      'click',
      'purchase_started',
      'purchase_completed',
      'install_started',
      'install_completed',
      'review_created',
      'rating_created'
    )),
  constraint marketplace_analytics_events_event_source_check
    check (event_source ~ '^[a-z0-9][a-z0-9_:-]{0,119}$')
);

create index if not exists marketplace_analytics_events_item_created_idx
  on public.marketplace_analytics_events(marketplace_item_id, created_at desc)
  where marketplace_item_id is not null;

create index if not exists marketplace_analytics_events_creator_created_idx
  on public.marketplace_analytics_events(creator_account_id, created_at desc)
  where creator_account_id is not null;

create index if not exists marketplace_analytics_events_type_created_idx
  on public.marketplace_analytics_events(event_type, created_at desc);

create index if not exists marketplace_analytics_events_source_created_idx
  on public.marketplace_analytics_events(event_source, created_at desc);

create index if not exists marketplace_analytics_events_store_created_idx
  on public.marketplace_analytics_events(store_id, created_at desc)
  where store_id is not null;

alter table public.marketplace_analytics_events enable row level security;

drop policy if exists "service role can manage marketplace analytics events" on public.marketplace_analytics_events;
create policy "service role can manage marketplace analytics events"
on public.marketplace_analytics_events
for all
to service_role
using (true)
with check (true);

create or replace function public.marketplace_analytics_events_guard_metadata()
returns trigger
language plpgsql
as $$
declare
  metadata_text text;
begin
  if new.event_type not in (
    'view',
    'click',
    'purchase_started',
    'purchase_completed',
    'install_started',
    'install_completed',
    'review_created',
    'rating_created'
  ) then
    raise exception 'Invalid marketplace analytics event_type: %', new.event_type;
  end if;

  if new.event_source !~ '^[a-z0-9][a-z0-9_:-]{0,119}$' then
    raise exception 'Invalid marketplace analytics event_source: %', new.event_source;
  end if;

  metadata_text := lower(new.metadata::text);

  if metadata_text like '%api_key%' or metadata_text like '%apikey%' then
    raise exception 'Marketplace analytics metadata must not contain API secrets';
  end if;

  if metadata_text like '%password%' or metadata_text like '%secret%' or metadata_text like '%token%' then
    raise exception 'Marketplace analytics metadata must not contain secrets';
  end if;

  if metadata_text like '%card_number%' or metadata_text like '%cvv%' or metadata_text like '%cvc%' then
    raise exception 'Marketplace analytics metadata must not contain card data';
  end if;

  if metadata_text like '%payout%' or metadata_text like '%bank_%' or metadata_text like '%iban%' then
    raise exception 'Marketplace analytics metadata must not contain payout credentials';
  end if;

  if metadata_text like '%private_key%' or metadata_text like '%privatekey%' then
    raise exception 'Marketplace analytics metadata must not contain private keys';
  end if;

  return new;
end;
$$;

drop trigger if exists marketplace_analytics_events_guard_metadata on public.marketplace_analytics_events;
create trigger marketplace_analytics_events_guard_metadata
before insert or update of metadata, event_type, event_source
on public.marketplace_analytics_events
for each row
execute function public.marketplace_analytics_events_guard_metadata();
