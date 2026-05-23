-- Visual builder editor foundation.
-- Additive only: prepares page schemas and editor state without changing products, checkout, reseller, provisioning, domains, tenant routing, or storefront publish logic.

create extension if not exists "pgcrypto";

create table if not exists public.store_builder_states (
  id uuid primary key default gen_random_uuid(),
  store_instance_id uuid not null references public.store_instances(id) on delete cascade,
  owner_user_id uuid references auth.users(id) on delete cascade,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),
  page_schema jsonb not null default '{"version":1,"sections":[]}'::jsonb,
  draft_schema jsonb not null default '{"version":1,"sections":[]}'::jsonb,
  published_schema jsonb,
  layout_tree jsonb not null default '{"root":{"children":[]}}'::jsonb,
  responsive_config jsonb not null default '{"desktop":{},"tablet":{},"mobile":{}}'::jsonb,
  editor_state jsonb not null default '{"selectedSectionId":null,"mode":"desktop"}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

alter table public.store_builder_states
  add column if not exists owner_user_id uuid references auth.users(id) on delete cascade,
  add column if not exists status text not null default 'draft',
  add column if not exists page_schema jsonb not null default '{"version":1,"sections":[]}'::jsonb,
  add column if not exists draft_schema jsonb not null default '{"version":1,"sections":[]}'::jsonb,
  add column if not exists published_schema jsonb,
  add column if not exists layout_tree jsonb not null default '{"root":{"children":[]}}'::jsonb,
  add column if not exists responsive_config jsonb not null default '{"desktop":{},"tablet":{},"mobile":{}}'::jsonb,
  add column if not exists editor_state jsonb not null default '{"selectedSectionId":null,"mode":"desktop"}'::jsonb,
  add column if not exists published_at timestamptz;

update public.store_builder_states states
set owner_user_id = instances.owner_user_id
from public.store_instances instances
where states.store_instance_id = instances.id
  and states.owner_user_id is null;

create unique index if not exists store_builder_states_instance_idx
  on public.store_builder_states(store_instance_id);

create index if not exists store_builder_states_owner_idx
  on public.store_builder_states(owner_user_id, updated_at desc);

alter table public.store_builder_states enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'store_builder_states'
      and policyname = 'Buyer store members read builder states'
  ) then
    create policy "Buyer store members read builder states"
      on public.store_builder_states for select
      using (public.can_access_store_instance(store_instance_id));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'store_builder_states'
      and policyname = 'Buyer store managers write builder states'
  ) then
    create policy "Buyer store managers write builder states"
      on public.store_builder_states for all
      using (public.can_manage_store_instance(store_instance_id))
      with check (public.can_manage_store_instance(store_instance_id));
  end if;
end $$;

create or replace function public.set_store_builder_states_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'store_builder_states_updated_at') then
    create trigger store_builder_states_updated_at
      before update on public.store_builder_states
      for each row execute function public.set_store_builder_states_updated_at();
  end if;
end $$;

