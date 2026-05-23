-- Store delivery and ownership transfer foundation for SHASTORE AI.
-- Additive only: scoped to delivering provisioned reseller stores to buyers.
-- Does not touch Stripe subscriptions, platform billing, checkout, payments,
-- shipping, public storefront rendering, template studio editor, admin billing,
-- auth core architecture, or domain core.

create table if not exists public.store_transfers (
  id uuid primary key default gen_random_uuid(),
  purchase_request_id uuid not null unique references public.store_purchase_requests(id) on delete cascade,
  provisioned_store_id uuid not null references public.provisioned_stores(id) on delete cascade,
  reseller_id uuid not null references public.reseller_profiles(id) on delete cascade,
  buyer_email text not null,
  buyer_whatsapp text,
  transfer_code text not null,
  transfer_status text not null default 'preparing'
    check (transfer_status in ('preparing', 'ready_for_delivery', 'delivered', 'failed')),
  delivery_status text not null default 'not_sent'
    check (delivery_status in ('not_sent', 'ready_for_delivery', 'delivered', 'failed')),
  credentials_package jsonb not null default '{}'::jsonb,
  ownership_assigned boolean not null default false,
  transferred_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists store_transfers_transfer_code_idx
  on public.store_transfers(transfer_code);

create index if not exists store_transfers_reseller_status_idx
  on public.store_transfers(reseller_id, transfer_status, created_at desc);

create index if not exists store_transfers_provisioned_store_idx
  on public.store_transfers(provisioned_store_id);

alter table public.store_transfers enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'store_transfers'
      and policyname = 'Resellers manage own store transfers'
  ) then
    create policy "Resellers manage own store transfers"
      on public.store_transfers for all
      using (
        exists (
          select 1
          from public.reseller_profiles profiles
          where profiles.id = store_transfers.reseller_id
            and profiles.user_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1
          from public.reseller_profiles profiles
          where profiles.id = store_transfers.reseller_id
            and profiles.user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'store_transfers'
      and policyname = 'Admins read all store transfers'
  ) then
    create policy "Admins read all store transfers"
      on public.store_transfers for select
      using (
        coalesce(auth.jwt() ->> 'role', '') = 'admin'
        or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
      );
  end if;
end $$;

create or replace function public.set_store_transfers_updated_at()
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
  if not exists (select 1 from pg_trigger where tgname = 'store_transfers_updated_at') then
    create trigger store_transfers_updated_at
      before update on public.store_transfers
      for each row execute function public.set_store_transfers_updated_at();
  end if;
end $$;

