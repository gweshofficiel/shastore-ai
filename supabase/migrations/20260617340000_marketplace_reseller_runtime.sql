-- MP-23: Marketplace reseller runtime foundation.
-- Additive reseller-item relationships only. No payouts, revenue sharing execution, or withdrawals.

create table if not exists public.marketplace_reseller_items (
  id uuid primary key default gen_random_uuid(),
  reseller_account_id uuid not null references public.marketplace_creator_accounts(id) on delete restrict,
  marketplace_item_id uuid not null references public.marketplace_items(id) on delete restrict,
  creator_account_id uuid null references public.marketplace_creator_accounts(id) on delete set null,
  reseller_status text not null default 'draft',
  commission_mode text not null default 'percentage',
  commission_value numeric(14, 2) not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketplace_reseller_items_reseller_status_check
    check (reseller_status in ('draft', 'active', 'suspended', 'archived')),
  constraint marketplace_reseller_items_commission_mode_check
    check (commission_mode in ('percentage', 'fixed')),
  constraint marketplace_reseller_items_commission_value_check
    check (commission_value >= 0),
  constraint marketplace_reseller_items_percentage_commission_check
    check (commission_mode <> 'percentage' or commission_value <= 100)
);

create unique index if not exists marketplace_reseller_items_active_reseller_item_idx
  on public.marketplace_reseller_items(reseller_account_id, marketplace_item_id)
  where reseller_status = 'active';

create index if not exists marketplace_reseller_items_item_created_idx
  on public.marketplace_reseller_items(marketplace_item_id, created_at desc);

create index if not exists marketplace_reseller_items_reseller_created_idx
  on public.marketplace_reseller_items(reseller_account_id, created_at desc);

create index if not exists marketplace_reseller_items_status_created_idx
  on public.marketplace_reseller_items(reseller_status, created_at desc);

create index if not exists marketplace_reseller_items_creator_created_idx
  on public.marketplace_reseller_items(creator_account_id, created_at desc)
  where creator_account_id is not null;

alter table public.marketplace_reseller_items enable row level security;

drop policy if exists "service role can manage marketplace reseller items" on public.marketplace_reseller_items;
create policy "service role can manage marketplace reseller items"
on public.marketplace_reseller_items
for all
to service_role
using (true)
with check (true);

create or replace function public.marketplace_reseller_items_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists marketplace_reseller_items_updated_at on public.marketplace_reseller_items;
create trigger marketplace_reseller_items_updated_at
before update on public.marketplace_reseller_items
for each row
execute function public.marketplace_reseller_items_set_updated_at();

create or replace function public.marketplace_reseller_items_guard_metadata()
returns trigger
language plpgsql
as $$
declare
  metadata_text text;
begin
  if new.reseller_status not in ('draft', 'active', 'suspended', 'archived') then
    raise exception 'Invalid marketplace reseller_status: %', new.reseller_status;
  end if;

  if new.commission_mode not in ('percentage', 'fixed') then
    raise exception 'Invalid marketplace commission_mode: %', new.commission_mode;
  end if;

  if coalesce(new.commission_value, 0) < 0 then
    raise exception 'Marketplace reseller commission_value cannot be negative';
  end if;

  if new.commission_mode = 'percentage' and coalesce(new.commission_value, 0) > 100 then
    raise exception 'Percentage marketplace reseller commission cannot exceed 100';
  end if;

  metadata_text := lower(new.metadata::text);

  if metadata_text like '%api_key%' or metadata_text like '%apikey%' then
    raise exception 'Marketplace reseller metadata must not contain API secrets';
  end if;

  if metadata_text like '%password%' or metadata_text like '%secret%' or metadata_text like '%token%' then
    raise exception 'Marketplace reseller metadata must not contain secrets';
  end if;

  if metadata_text like '%card_number%' or metadata_text like '%cvv%' or metadata_text like '%cvc%' then
    raise exception 'Marketplace reseller metadata must not contain card data';
  end if;

  if metadata_text like '%payout%' or metadata_text like '%bank_account%' or metadata_text like '%iban%' then
    raise exception 'Marketplace reseller metadata must not contain payout credentials';
  end if;

  if metadata_text like '%withdrawal%' or metadata_text like '%withdraw_%' then
    raise exception 'Marketplace reseller metadata must not contain withdrawal credentials';
  end if;

  return new;
end;
$$;

drop trigger if exists marketplace_reseller_items_guard_metadata on public.marketplace_reseller_items;
create trigger marketplace_reseller_items_guard_metadata
before insert or update of metadata, reseller_status, commission_mode, commission_value
on public.marketplace_reseller_items
for each row
execute function public.marketplace_reseller_items_guard_metadata();
