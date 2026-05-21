-- Automated store provisioning foundation for SHASTORE AI.
-- Additive only: scoped to reseller purchase requests becoming buyer-ready store drafts.
-- Does not touch auth core, platform billing, Stripe subscriptions, checkout,
-- payments, shipping, template studio editor, public storefront rendering,
-- admin billing, or domain systems.

create table if not exists public.provisioned_stores (
  id uuid primary key default gen_random_uuid(),
  purchase_request_id uuid not null unique references public.store_purchase_requests(id) on delete cascade,
  reseller_id uuid not null references public.reseller_profiles(id) on delete cascade,
  buyer_email text not null,
  buyer_name text not null,
  source_template_id text,
  source_showcase_item_id uuid not null references public.reseller_showcase_items(id) on delete cascade,
  provisioned_store_slug text not null,
  provisioned_store_name text not null,
  provisioned_store_data jsonb not null default '{}'::jsonb,
  provisioning_status text not null default 'draft'
    check (provisioning_status in ('draft', 'preparing', 'ready', 'delivered', 'failed')),
  ownership_status text not null default 'buyer_placeholder',
  buyer_user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (reseller_id, provisioned_store_slug)
);

create index if not exists provisioned_stores_reseller_status_idx
  on public.provisioned_stores(reseller_id, provisioning_status, created_at desc);

create index if not exists provisioned_stores_showcase_item_idx
  on public.provisioned_stores(source_showcase_item_id, created_at desc);

alter table public.provisioned_stores enable row level security;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'store_transfer_records'
  ) then
    alter table public.store_transfer_records
      drop constraint if exists store_transfer_records_transfer_status_check;

    alter table public.store_transfer_records
      add constraint store_transfer_records_transfer_status_check
      check (
        transfer_status in (
          'not_started',
          'preparing',
          'account_pending',
          'ownership_pending',
          'domain_pending',
          'ready',
          'completed',
          'blocked'
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'provisioned_stores'
      and policyname = 'Resellers manage own provisioned stores'
  ) then
    create policy "Resellers manage own provisioned stores"
      on public.provisioned_stores for all
      using (
        exists (
          select 1
          from public.reseller_profiles profiles
          where profiles.id = provisioned_stores.reseller_id
            and profiles.user_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1
          from public.reseller_profiles profiles
          where profiles.id = provisioned_stores.reseller_id
            and profiles.user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'provisioned_stores'
      and policyname = 'Admins read all provisioned stores'
  ) then
    create policy "Admins read all provisioned stores"
      on public.provisioned_stores for select
      using (
        coalesce(auth.jwt() ->> 'role', '') = 'admin'
        or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
      );
  end if;
end $$;

create or replace function public.set_provisioned_stores_updated_at()
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
  if not exists (select 1 from pg_trigger where tgname = 'provisioned_stores_updated_at') then
    create trigger provisioned_stores_updated_at
      before update on public.provisioned_stores
      for each row execute function public.set_provisioned_stores_updated_at();
  end if;
end $$;
