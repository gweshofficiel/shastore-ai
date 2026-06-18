-- MP-12: Marketplace app runtime foundation.
-- Additive app bindings only. No execution, installation, or secrets.

create table if not exists public.marketplace_app_bindings (
  id uuid primary key default gen_random_uuid(),
  marketplace_item_id uuid not null unique references public.marketplace_items(id) on delete restrict,
  app_key text not null unique,
  app_name text not null,
  app_version text not null default '1.0.0',
  app_manifest jsonb not null default '{}'::jsonb,
  app_binding_status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketplace_app_bindings_app_key_check
    check (app_key ~ '^[a-z0-9][a-z0-9_-]{0,119}$'),
  constraint marketplace_app_bindings_app_name_check
    check (char_length(app_name) > 0),
  constraint marketplace_app_bindings_app_version_check
    check (char_length(app_version) > 0),
  constraint marketplace_app_bindings_status_check
    check (app_binding_status in ('draft', 'active', 'disabled', 'archived'))
);

create index if not exists marketplace_app_bindings_status_created_idx
  on public.marketplace_app_bindings(app_binding_status, created_at desc);

create index if not exists marketplace_app_bindings_item_idx
  on public.marketplace_app_bindings(marketplace_item_id);

alter table public.marketplace_app_bindings enable row level security;

drop policy if exists "service role can manage marketplace app bindings" on public.marketplace_app_bindings;
create policy "service role can manage marketplace app bindings"
on public.marketplace_app_bindings
for all
to service_role
using (true)
with check (true);

create or replace function public.marketplace_app_bindings_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists marketplace_app_bindings_updated_at on public.marketplace_app_bindings;
create trigger marketplace_app_bindings_updated_at
before update on public.marketplace_app_bindings
for each row
execute function public.marketplace_app_bindings_set_updated_at();

create or replace function public.marketplace_app_bindings_guard_manifest()
returns trigger
language plpgsql
as $$
declare
  manifest_text text;
begin
  if new.app_binding_status not in ('draft', 'active', 'disabled', 'archived') then
    raise exception 'Invalid marketplace app_binding_status: %', new.app_binding_status;
  end if;

  manifest_text := lower(new.app_manifest::text);

  if manifest_text like '%api_key%' or manifest_text like '%apikey%' then
    raise exception 'Marketplace app_manifest must not contain API secrets';
  end if;

  if manifest_text like '%password%' or manifest_text like '%secret%' or manifest_text like '%token%' then
    raise exception 'Marketplace app_manifest must not contain secrets';
  end if;

  if coalesce((new.app_manifest ->> 'executable')::boolean, false) = true then
    raise exception 'Marketplace app_manifest cannot enable executable apps in foundation runtime';
  end if;

  return new;
end;
$$;

drop trigger if exists marketplace_app_bindings_guard_manifest on public.marketplace_app_bindings;
create trigger marketplace_app_bindings_guard_manifest
before insert or update of app_manifest, app_binding_status
on public.marketplace_app_bindings
for each row
execute function public.marketplace_app_bindings_guard_manifest();

insert into public.marketplace_app_bindings (
  marketplace_item_id,
  app_key,
  app_name,
  app_version,
  app_manifest,
  app_binding_status
)
select
  mi.id,
  'analytics-connector',
  mi.name,
  '1.0.0',
  jsonb_build_object(
    'capabilities', jsonb_build_array('analytics_sync', 'event_tracking'),
    'category', 'analytics',
    'executable', false,
    'foundation_only', true,
    'install_runtime', false,
    'source', 'marketplace_app_runtime_seed'
  ),
  case
    when mi.status = 'approved' then 'active'
    when mi.status = 'archived' then 'archived'
    else 'draft'
  end
from public.marketplace_items mi
where mi.item_type = 'app'
  and mi.item_key = 'app:analytics-connector'
  and not exists (
    select 1
    from public.marketplace_app_bindings mab
    where mab.marketplace_item_id = mi.id
  );

update public.marketplace_items mi
set linked_app_id = mab.id
from public.marketplace_app_bindings mab
where mi.item_type = 'app'
  and mi.id = mab.marketplace_item_id
  and (mi.linked_app_id is null or mi.linked_app_id <> mab.id);

alter table public.marketplace_items
  drop constraint if exists marketplace_items_linked_app_id_fkey;

alter table public.marketplace_items
  add constraint marketplace_items_linked_app_id_fkey
  foreign key (linked_app_id) references public.marketplace_app_bindings(id) on delete restrict;
