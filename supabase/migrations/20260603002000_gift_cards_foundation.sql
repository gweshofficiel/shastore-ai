-- Gift cards foundation.
-- Additive only: store-scoped gift card balances and redemption tracking.

create table if not exists public.store_gift_cards (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  store_id uuid not null references public.stores(id) on delete cascade,
  code text not null,
  initial_balance numeric(12, 2) not null check (initial_balance >= 0),
  remaining_balance numeric(12, 2) not null check (remaining_balance >= 0),
  currency text not null default 'USD',
  status text not null default 'active' check (status in ('active', 'used', 'expired', 'disabled')),
  expires_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (remaining_balance <= initial_balance)
);

create table if not exists public.store_gift_card_redemptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  store_id uuid not null references public.stores(id) on delete cascade,
  gift_card_id uuid not null references public.store_gift_cards(id) on delete cascade,
  order_source text not null check (order_source in ('orders', 'store_orders')),
  order_id uuid not null,
  amount numeric(12, 2) not null check (amount > 0),
  balance_after numeric(12, 2) not null check (balance_after >= 0),
  status text not null default 'redeemed' check (status in ('redeemed', 'voided')),
  created_at timestamptz not null default now(),
  unique (gift_card_id, order_source, order_id)
);

alter table if exists public.store_orders
  add column if not exists gift_card_id uuid references public.store_gift_cards(id) on delete set null,
  add column if not exists gift_card_code text,
  add column if not exists gift_card_amount numeric(12, 2) not null default 0;

alter table if exists public.orders
  add column if not exists gift_card_id uuid references public.store_gift_cards(id) on delete set null,
  add column if not exists gift_card_code text,
  add column if not exists gift_card_amount numeric(12, 2) not null default 0;

create unique index if not exists store_gift_cards_store_code_unique_idx
on public.store_gift_cards(store_id, lower(code));

create index if not exists store_gift_cards_workspace_store_idx
on public.store_gift_cards(workspace_id, store_id, status, created_at desc);

create index if not exists store_gift_card_redemptions_card_idx
on public.store_gift_card_redemptions(workspace_id, store_id, gift_card_id, created_at desc);

create or replace function public.set_store_gift_cards_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.code = upper(trim(new.code));
  new.currency = upper(trim(new.currency));
  new.remaining_balance = least(new.remaining_balance, new.initial_balance);
  return new;
end;
$$;

drop trigger if exists store_gift_cards_updated_at on public.store_gift_cards;
create trigger store_gift_cards_updated_at
before insert or update on public.store_gift_cards
for each row execute function public.set_store_gift_cards_updated_at();

create or replace function public.redeem_store_gift_card(
  gift_card_id_input uuid,
  amount_input numeric,
  order_source_input text,
  order_id_input uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  card_row public.store_gift_cards%rowtype;
  new_balance numeric(12, 2);
begin
  if amount_input <= 0 then
    return true;
  end if;

  if exists (
    select 1 from public.store_gift_card_redemptions
    where gift_card_id = gift_card_id_input
      and order_source = order_source_input
      and order_id = order_id_input
      and status = 'redeemed'
  ) then
    return true;
  end if;

  select *
  into card_row
  from public.store_gift_cards
  where id = gift_card_id_input
    and status = 'active'
    and remaining_balance >= amount_input
    and (expires_at is null or expires_at >= now())
  for update;

  if not found then
    return false;
  end if;

  new_balance := card_row.remaining_balance - amount_input;

  update public.store_gift_cards
  set remaining_balance = new_balance,
      status = case when new_balance <= 0 then 'used' else status end,
      updated_at = now()
  where id = gift_card_id_input;

  insert into public.store_gift_card_redemptions (
    workspace_id,
    store_id,
    gift_card_id,
    order_source,
    order_id,
    amount,
    balance_after
  ) values (
    card_row.workspace_id,
    card_row.store_id,
    card_row.id,
    order_source_input,
    order_id_input,
    amount_input,
    new_balance
  )
  on conflict (gift_card_id, order_source, order_id) do nothing;

  return true;
end;
$$;

grant execute on function public.redeem_store_gift_card(uuid, numeric, text, uuid) to authenticated;
grant execute on function public.redeem_store_gift_card(uuid, numeric, text, uuid) to service_role;

alter table public.store_gift_cards enable row level security;
alter table public.store_gift_card_redemptions enable row level security;

drop policy if exists "workspace members read store gift cards" on public.store_gift_cards;
drop policy if exists "workspace editors write store gift cards" on public.store_gift_cards;
drop policy if exists "workspace members read store gift card redemptions" on public.store_gift_card_redemptions;
drop policy if exists "workspace editors write store gift card redemptions" on public.store_gift_card_redemptions;

create policy "workspace members read store gift cards"
on public.store_gift_cards for select to authenticated
using (public.can_access_workspace(workspace_id));

create policy "workspace editors write store gift cards"
on public.store_gift_cards for all to authenticated
using (public.workspace_can_edit(workspace_id))
with check (public.workspace_can_edit(workspace_id));

create policy "workspace members read store gift card redemptions"
on public.store_gift_card_redemptions for select to authenticated
using (public.can_access_workspace(workspace_id));

create policy "workspace editors write store gift card redemptions"
on public.store_gift_card_redemptions for all to authenticated
using (public.workspace_can_edit(workspace_id))
with check (public.workspace_can_edit(workspace_id));
