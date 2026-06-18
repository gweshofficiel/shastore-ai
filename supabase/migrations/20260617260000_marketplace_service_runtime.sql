-- MP-13: Marketplace service runtime foundation.
-- Additive service bindings only. No purchase, booking, delivery, or payouts.

create table if not exists public.marketplace_service_bindings (
  id uuid primary key default gen_random_uuid(),
  marketplace_item_id uuid not null unique references public.marketplace_items(id) on delete restrict,
  service_key text not null unique,
  service_name text not null,
  service_category text not null default 'general',
  service_description text not null default '',
  service_duration_days integer not null default 0,
  service_binding_status text not null default 'draft',
  service_requirements jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketplace_service_bindings_service_key_check
    check (service_key ~ '^[a-z0-9][a-z0-9_-]{0,119}$'),
  constraint marketplace_service_bindings_service_name_check
    check (char_length(service_name) > 0),
  constraint marketplace_service_bindings_service_category_check
    check (char_length(service_category) > 0),
  constraint marketplace_service_bindings_duration_check
    check (service_duration_days >= 0),
  constraint marketplace_service_bindings_status_check
    check (service_binding_status in ('draft', 'active', 'disabled', 'archived'))
);

create index if not exists marketplace_service_bindings_status_created_idx
  on public.marketplace_service_bindings(service_binding_status, created_at desc);

create index if not exists marketplace_service_bindings_item_idx
  on public.marketplace_service_bindings(marketplace_item_id);

alter table public.marketplace_service_bindings enable row level security;

drop policy if exists "service role can manage marketplace service bindings" on public.marketplace_service_bindings;
create policy "service role can manage marketplace service bindings"
on public.marketplace_service_bindings
for all
to service_role
using (true)
with check (true);

create or replace function public.marketplace_service_bindings_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists marketplace_service_bindings_updated_at on public.marketplace_service_bindings;
create trigger marketplace_service_bindings_updated_at
before update on public.marketplace_service_bindings
for each row
execute function public.marketplace_service_bindings_set_updated_at();

create or replace function public.marketplace_service_bindings_guard_requirements()
returns trigger
language plpgsql
as $$
declare
  requirements_text text;
begin
  if new.service_binding_status not in ('draft', 'active', 'disabled', 'archived') then
    raise exception 'Invalid marketplace service_binding_status: %', new.service_binding_status;
  end if;

  requirements_text := lower(new.service_requirements::text);

  if requirements_text like '%api_key%' or requirements_text like '%apikey%' then
    raise exception 'Marketplace service_requirements must not contain API secrets';
  end if;

  if requirements_text like '%password%' or requirements_text like '%secret%' or requirements_text like '%token%' then
    raise exception 'Marketplace service_requirements must not contain secrets';
  end if;

  return new;
end;
$$;

drop trigger if exists marketplace_service_bindings_guard_requirements on public.marketplace_service_bindings;
create trigger marketplace_service_bindings_guard_requirements
before insert or update of service_requirements, service_binding_status
on public.marketplace_service_bindings
for each row
execute function public.marketplace_service_bindings_guard_requirements();

insert into public.marketplace_service_bindings (
  marketplace_item_id,
  service_key,
  service_name,
  service_category,
  service_description,
  service_duration_days,
  service_binding_status,
  service_requirements
)
select
  mi.id,
  'store-launch-assistance',
  mi.name,
  'launch_assistance',
  'Guided store launch assistance with onboarding checkpoints and setup review.',
  14,
  case
    when mi.status = 'approved' then 'active'
    when mi.status = 'archived' then 'archived'
    else 'draft'
  end,
  jsonb_build_object(
    'booking_runtime', false,
    'delivery_runtime', false,
    'foundation_only', true,
    'prerequisites', jsonb_build_array('active_store', 'published_catalog'),
    'purchase_runtime', false,
    'source', 'marketplace_service_runtime_seed'
  )
from public.marketplace_items mi
where mi.item_type = 'service'
  and mi.item_key = 'service:store-launch-assistance'
  and not exists (
    select 1
    from public.marketplace_service_bindings msb
    where msb.marketplace_item_id = mi.id
  );

update public.marketplace_items mi
set linked_service_id = msb.id
from public.marketplace_service_bindings msb
where mi.item_type = 'service'
  and mi.id = msb.marketplace_item_id
  and (mi.linked_service_id is null or mi.linked_service_id <> msb.id);

alter table public.marketplace_items
  drop constraint if exists marketplace_items_linked_service_id_fkey;

alter table public.marketplace_items
  add constraint marketplace_items_linked_service_id_fkey
  foreign key (linked_service_id) references public.marketplace_service_bindings(id) on delete restrict;
