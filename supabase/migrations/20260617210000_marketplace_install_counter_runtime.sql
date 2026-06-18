-- MP-8: Marketplace install counter runtime foundation.
-- Additive install tracking only. No purchase, activation, or payout runtime.

alter table public.marketplace_items
  add column if not exists live_installs integer not null default 0,
  add column if not exists install_count_updated_at timestamptz null;

update public.marketplace_items
set live_installs = 0
where live_installs is null;

alter table public.marketplace_items
  drop constraint if exists marketplace_items_install_count_check;

alter table public.marketplace_items
  add constraint marketplace_items_install_count_check
  check (install_count >= 0);

alter table public.marketplace_items
  drop constraint if exists marketplace_items_live_installs_check;

alter table public.marketplace_items
  add constraint marketplace_items_live_installs_check
  check (live_installs >= 0);

create table if not exists public.marketplace_install_events (
  id uuid primary key default gen_random_uuid(),
  marketplace_item_id uuid not null references public.marketplace_items(id) on delete restrict,
  account_id uuid null references auth.users(id) on delete set null,
  store_id uuid null references public.stores(id) on delete set null,
  item_type text not null,
  install_status text not null default 'installed',
  source text not null default 'marketplace_install_runtime',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketplace_install_events_item_type_check
    check (item_type in ('template', 'theme', 'plugin', 'app', 'service')),
  constraint marketplace_install_events_install_status_check
    check (install_status in ('installed', 'active', 'disabled', 'uninstalled', 'failed'))
);

create index if not exists marketplace_install_events_item_created_idx
  on public.marketplace_install_events(marketplace_item_id, created_at desc);

create index if not exists marketplace_install_events_store_created_idx
  on public.marketplace_install_events(store_id, created_at desc)
  where store_id is not null;

create index if not exists marketplace_install_events_status_created_idx
  on public.marketplace_install_events(install_status, created_at desc);

create unique index if not exists marketplace_install_events_active_store_unique_idx
  on public.marketplace_install_events(marketplace_item_id, store_id)
  where store_id is not null and install_status in ('installed', 'active');

alter table public.marketplace_install_events enable row level security;

drop policy if exists "service role can manage marketplace install events" on public.marketplace_install_events;
create policy "service role can manage marketplace install events"
on public.marketplace_install_events
for all
to service_role
using (true)
with check (true);

create or replace function public.marketplace_install_events_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists marketplace_install_events_updated_at on public.marketplace_install_events;
create trigger marketplace_install_events_updated_at
before update on public.marketplace_install_events
for each row
execute function public.marketplace_install_events_set_updated_at();

create or replace function public.marketplace_items_guard_install_counters()
returns trigger
language plpgsql
as $$
begin
  if coalesce(new.install_count, 0) < 0 then
    raise exception 'Marketplace install_count cannot be negative';
  end if;

  if coalesce(new.live_installs, 0) < 0 then
    raise exception 'Marketplace live_installs cannot be negative';
  end if;

  return new;
end;
$$;

drop trigger if exists marketplace_items_guard_install_counters on public.marketplace_items;
create trigger marketplace_items_guard_install_counters
before insert or update of install_count, live_installs
on public.marketplace_items
for each row
execute function public.marketplace_items_guard_install_counters();
