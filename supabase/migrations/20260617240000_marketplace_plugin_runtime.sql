-- MP-11: Marketplace plugin runtime foundation.
-- Additive plugin bindings only. No execution, installation, or secrets.

create table if not exists public.marketplace_plugin_bindings (
  id uuid primary key default gen_random_uuid(),
  marketplace_item_id uuid not null unique references public.marketplace_items(id) on delete restrict,
  plugin_key text not null unique,
  plugin_name text not null,
  plugin_version text not null default '1.0.0',
  plugin_manifest jsonb not null default '{}'::jsonb,
  plugin_binding_status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketplace_plugin_bindings_plugin_key_check
    check (plugin_key ~ '^[a-z0-9][a-z0-9_-]{0,119}$'),
  constraint marketplace_plugin_bindings_plugin_name_check
    check (char_length(plugin_name) > 0),
  constraint marketplace_plugin_bindings_plugin_version_check
    check (char_length(plugin_version) > 0),
  constraint marketplace_plugin_bindings_status_check
    check (plugin_binding_status in ('draft', 'active', 'disabled', 'archived'))
);

create index if not exists marketplace_plugin_bindings_status_created_idx
  on public.marketplace_plugin_bindings(plugin_binding_status, created_at desc);

create index if not exists marketplace_plugin_bindings_item_idx
  on public.marketplace_plugin_bindings(marketplace_item_id);

alter table public.marketplace_plugin_bindings enable row level security;

drop policy if exists "service role can manage marketplace plugin bindings" on public.marketplace_plugin_bindings;
create policy "service role can manage marketplace plugin bindings"
on public.marketplace_plugin_bindings
for all
to service_role
using (true)
with check (true);

create or replace function public.marketplace_plugin_bindings_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists marketplace_plugin_bindings_updated_at on public.marketplace_plugin_bindings;
create trigger marketplace_plugin_bindings_updated_at
before update on public.marketplace_plugin_bindings
for each row
execute function public.marketplace_plugin_bindings_set_updated_at();

create or replace function public.marketplace_plugin_bindings_guard_manifest()
returns trigger
language plpgsql
as $$
declare
  manifest_text text;
begin
  if new.plugin_binding_status not in ('draft', 'active', 'disabled', 'archived') then
    raise exception 'Invalid marketplace plugin_binding_status: %', new.plugin_binding_status;
  end if;

  manifest_text := lower(new.plugin_manifest::text);

  if manifest_text like '%api_key%' or manifest_text like '%apikey%' then
    raise exception 'Marketplace plugin_manifest must not contain API secrets';
  end if;

  if manifest_text like '%password%' or manifest_text like '%secret%' or manifest_text like '%token%' then
    raise exception 'Marketplace plugin_manifest must not contain secrets';
  end if;

  if coalesce((new.plugin_manifest ->> 'executable')::boolean, false) = true then
    raise exception 'Marketplace plugin_manifest cannot enable executable plugins in foundation runtime';
  end if;

  return new;
end;
$$;

drop trigger if exists marketplace_plugin_bindings_guard_manifest on public.marketplace_plugin_bindings;
create trigger marketplace_plugin_bindings_guard_manifest
before insert or update of plugin_manifest, plugin_binding_status
on public.marketplace_plugin_bindings
for each row
execute function public.marketplace_plugin_bindings_guard_manifest();

insert into public.marketplace_plugin_bindings (
  marketplace_item_id,
  plugin_key,
  plugin_name,
  plugin_version,
  plugin_manifest,
  plugin_binding_status
)
select
  mi.id,
  'loyalty-foundation',
  mi.name,
  '1.0.0',
  jsonb_build_object(
    'capabilities', jsonb_build_array('loyalty_points', 'customer_rewards'),
    'category', 'loyalty',
    'executable', false,
    'foundation_only', true,
    'install_runtime', false,
    'source', 'marketplace_plugin_runtime_seed'
  ),
  case
    when mi.status = 'approved' then 'active'
    when mi.status = 'archived' then 'archived'
    else 'draft'
  end
from public.marketplace_items mi
where mi.item_type = 'plugin'
  and mi.item_key = 'plugin:loyalty-foundation'
  and not exists (
    select 1
    from public.marketplace_plugin_bindings mpb
    where mpb.marketplace_item_id = mi.id
  );

update public.marketplace_items mi
set linked_plugin_id = mpb.id
from public.marketplace_plugin_bindings mpb
where mi.item_type = 'plugin'
  and mi.id = mpb.marketplace_item_id
  and (mi.linked_plugin_id is null or mi.linked_plugin_id <> mpb.id);

alter table public.marketplace_items
  drop constraint if exists marketplace_items_linked_plugin_id_fkey;

alter table public.marketplace_items
  add constraint marketplace_items_linked_plugin_id_fkey
  foreign key (linked_plugin_id) references public.marketplace_plugin_bindings(id) on delete restrict;
