-- MP-21: Marketplace template sales runtime foundation.
-- Additive template sales records only. No cloning, delivery, payouts, or revenue execution.

create table if not exists public.marketplace_template_sales (
  id uuid primary key default gen_random_uuid(),
  marketplace_purchase_id uuid not null references public.marketplace_purchases(id) on delete restrict,
  marketplace_item_id uuid not null references public.marketplace_items(id) on delete restrict,
  template_id uuid not null references public.template_registry(id) on delete restrict,
  buyer_account_id uuid null references auth.users(id) on delete set null,
  creator_account_id uuid null references public.marketplace_creator_accounts(id) on delete set null,
  sale_status text not null default 'pending',
  amount numeric(14, 2) not null default 0,
  currency text not null default 'USD',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketplace_template_sales_sale_status_check
    check (sale_status in ('pending', 'completed', 'failed', 'cancelled', 'refunded')),
  constraint marketplace_template_sales_currency_check
    check (currency in ('USD', 'EUR', 'MAD')),
  constraint marketplace_template_sales_amount_check
    check (amount >= 0)
);

create unique index if not exists marketplace_template_sales_completed_purchase_idx
  on public.marketplace_template_sales(marketplace_purchase_id)
  where sale_status = 'completed';

create index if not exists marketplace_template_sales_item_created_idx
  on public.marketplace_template_sales(marketplace_item_id, created_at desc);

create index if not exists marketplace_template_sales_template_created_idx
  on public.marketplace_template_sales(template_id, created_at desc);

create index if not exists marketplace_template_sales_status_created_idx
  on public.marketplace_template_sales(sale_status, created_at desc);

alter table public.marketplace_template_sales enable row level security;

drop policy if exists "service role can manage marketplace template sales" on public.marketplace_template_sales;
create policy "service role can manage marketplace template sales"
on public.marketplace_template_sales
for all
to service_role
using (true)
with check (true);

create or replace function public.marketplace_template_sales_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists marketplace_template_sales_updated_at on public.marketplace_template_sales;
create trigger marketplace_template_sales_updated_at
before update on public.marketplace_template_sales
for each row
execute function public.marketplace_template_sales_set_updated_at();

create or replace function public.marketplace_template_sales_guard_metadata()
returns trigger
language plpgsql
as $$
declare
  metadata_text text;
begin
  if new.sale_status not in ('pending', 'completed', 'failed', 'cancelled', 'refunded') then
    raise exception 'Invalid marketplace template sale_status: %', new.sale_status;
  end if;

  if new.currency not in ('USD', 'EUR', 'MAD') then
    raise exception 'Invalid marketplace template sale currency: %', new.currency;
  end if;

  if coalesce(new.amount, 0) < 0 then
    raise exception 'Marketplace template sale amount cannot be negative';
  end if;

  metadata_text := lower(new.metadata::text);

  if metadata_text like '%api_key%' or metadata_text like '%apikey%' then
    raise exception 'Marketplace template sale metadata must not contain API secrets';
  end if;

  if metadata_text like '%password%' or metadata_text like '%secret%' or metadata_text like '%token%' then
    raise exception 'Marketplace template sale metadata must not contain secrets';
  end if;

  if metadata_text like '%card_number%' or metadata_text like '%cvv%' or metadata_text like '%cvc%' then
    raise exception 'Marketplace template sale metadata must not contain card data';
  end if;

  if metadata_text like '%payout%' or metadata_text like '%bank_account%' or metadata_text like '%iban%' then
    raise exception 'Marketplace template sale metadata must not contain payout credentials';
  end if;

  return new;
end;
$$;

drop trigger if exists marketplace_template_sales_guard_metadata on public.marketplace_template_sales;
create trigger marketplace_template_sales_guard_metadata
before insert or update of metadata, sale_status, amount, currency
on public.marketplace_template_sales
for each row
execute function public.marketplace_template_sales_guard_metadata();
