-- MP-22: Marketplace app and plugin installation runtime foundation.
-- Additive installation records only. No app/plugin execution, remote scripts, or payouts.

create table if not exists public.marketplace_app_plugin_installations (
  id uuid primary key default gen_random_uuid(),
  marketplace_purchase_id uuid not null references public.marketplace_purchases(id) on delete restrict,
  marketplace_item_id uuid not null references public.marketplace_items(id) on delete restrict,
  app_binding_id uuid null references public.marketplace_app_bindings(id) on delete restrict,
  plugin_binding_id uuid null references public.marketplace_plugin_bindings(id) on delete restrict,
  buyer_account_id uuid null references auth.users(id) on delete set null,
  store_id uuid null references public.stores(id) on delete set null,
  installation_type text not null,
  installation_status text not null default 'pending',
  installed_at timestamptz null,
  disabled_at timestamptz null,
  uninstalled_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketplace_app_plugin_installations_type_check
    check (installation_type in ('app', 'plugin')),
  constraint marketplace_app_plugin_installations_status_check
    check (installation_status in ('pending', 'installed', 'active', 'disabled', 'uninstalled', 'failed')),
  constraint marketplace_app_plugin_installations_type_binding_check
    check (
      (
        installation_type = 'app'
        and app_binding_id is not null
        and plugin_binding_id is null
      )
      or (
        installation_type = 'plugin'
        and plugin_binding_id is not null
        and app_binding_id is null
      )
    )
);

create unique index if not exists marketplace_app_plugin_installations_active_purchase_idx
  on public.marketplace_app_plugin_installations(marketplace_purchase_id)
  where installation_status in ('pending', 'installed', 'active');

create unique index if not exists marketplace_app_plugin_installations_active_store_item_idx
  on public.marketplace_app_plugin_installations(marketplace_item_id, store_id)
  where store_id is not null and installation_status in ('pending', 'installed', 'active');

create index if not exists marketplace_app_plugin_installations_item_created_idx
  on public.marketplace_app_plugin_installations(marketplace_item_id, created_at desc);

create index if not exists marketplace_app_plugin_installations_store_created_idx
  on public.marketplace_app_plugin_installations(store_id, created_at desc)
  where store_id is not null;

create index if not exists marketplace_app_plugin_installations_status_created_idx
  on public.marketplace_app_plugin_installations(installation_status, created_at desc);

create index if not exists marketplace_app_plugin_installations_type_created_idx
  on public.marketplace_app_plugin_installations(installation_type, created_at desc);

alter table public.marketplace_app_plugin_installations enable row level security;

drop policy if exists "service role can manage marketplace app plugin installations" on public.marketplace_app_plugin_installations;
create policy "service role can manage marketplace app plugin installations"
on public.marketplace_app_plugin_installations
for all
to service_role
using (true)
with check (true);

create or replace function public.marketplace_app_plugin_installations_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists marketplace_app_plugin_installations_updated_at on public.marketplace_app_plugin_installations;
create trigger marketplace_app_plugin_installations_updated_at
before update on public.marketplace_app_plugin_installations
for each row
execute function public.marketplace_app_plugin_installations_set_updated_at();

create or replace function public.marketplace_app_plugin_installations_guard_metadata()
returns trigger
language plpgsql
as $$
declare
  metadata_text text;
begin
  if new.installation_type not in ('app', 'plugin') then
    raise exception 'Invalid marketplace installation_type: %', new.installation_type;
  end if;

  if new.installation_status not in ('pending', 'installed', 'active', 'disabled', 'uninstalled', 'failed') then
    raise exception 'Invalid marketplace installation_status: %', new.installation_status;
  end if;

  if new.installation_type = 'app' and (new.app_binding_id is null or new.plugin_binding_id is not null) then
    raise exception 'App installations require app_binding_id and no plugin_binding_id';
  end if;

  if new.installation_type = 'plugin' and (new.plugin_binding_id is null or new.app_binding_id is not null) then
    raise exception 'Plugin installations require plugin_binding_id and no app_binding_id';
  end if;

  metadata_text := lower(new.metadata::text);

  if metadata_text like '%api_key%' or metadata_text like '%apikey%' then
    raise exception 'Marketplace installation metadata must not contain API secrets';
  end if;

  if metadata_text like '%password%' or metadata_text like '%secret%' or metadata_text like '%token%' then
    raise exception 'Marketplace installation metadata must not contain secrets';
  end if;

  if metadata_text like '%card_number%' or metadata_text like '%cvv%' or metadata_text like '%cvc%' then
    raise exception 'Marketplace installation metadata must not contain card data';
  end if;

  if metadata_text like '%payout%' or metadata_text like '%bank_account%' or metadata_text like '%iban%' then
    raise exception 'Marketplace installation metadata must not contain payout credentials';
  end if;

  if metadata_text like '%private_key%' or metadata_text like '%privatekey%' then
    raise exception 'Marketplace installation metadata must not contain private keys';
  end if;

  if metadata_text like '%<script%' or metadata_text like '%javascript:%' or metadata_text like '%eval(%' then
    raise exception 'Marketplace installation metadata must not contain executable code';
  end if;

  return new;
end;
$$;

drop trigger if exists marketplace_app_plugin_installations_guard_metadata on public.marketplace_app_plugin_installations;
create trigger marketplace_app_plugin_installations_guard_metadata
before insert or update of metadata, installation_type, installation_status, app_binding_id, plugin_binding_id
on public.marketplace_app_plugin_installations
for each row
execute function public.marketplace_app_plugin_installations_guard_metadata();
