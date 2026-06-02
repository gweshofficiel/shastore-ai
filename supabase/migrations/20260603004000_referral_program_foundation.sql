-- Referral program foundation.
-- Additive only: customer referral codes, referral attribution, and future reward status.

create table if not exists public.store_customer_referral_codes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  store_id uuid not null references public.stores(id) on delete cascade,
  customer_id uuid not null references public.store_customers(id) on delete cascade,
  code text not null,
  status text not null default 'active' check (status in ('active', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, customer_id)
);

create table if not exists public.store_referrals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  store_id uuid not null references public.stores(id) on delete cascade,
  referral_code_id uuid not null references public.store_customer_referral_codes(id) on delete cascade,
  referral_code text not null,
  referrer_customer_id uuid not null references public.store_customers(id) on delete cascade,
  referred_customer_id uuid references public.store_customers(id) on delete set null,
  referred_email text,
  referred_phone text,
  referred_order_source text check (referred_order_source is null or referred_order_source in ('orders', 'store_orders')),
  referred_order_id uuid,
  status text not null default 'pending' check (status in ('pending', 'qualified', 'rewarded', 'cancelled')),
  reward_status text not null default 'not_ready' check (reward_status in ('not_ready', 'ready', 'rewarded', 'cancelled')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.store_orders
  add column if not exists referral_id uuid references public.store_referrals(id) on delete set null,
  add column if not exists referral_code text;

alter table if exists public.orders
  add column if not exists referral_id uuid references public.store_referrals(id) on delete set null,
  add column if not exists referral_code text;

create unique index if not exists store_customer_referral_codes_store_code_unique_idx
on public.store_customer_referral_codes(store_id, lower(code));

create index if not exists store_customer_referral_codes_workspace_store_idx
on public.store_customer_referral_codes(workspace_id, store_id, customer_id);

create index if not exists store_referrals_workspace_store_status_idx
on public.store_referrals(workspace_id, store_id, status, created_at desc);

create index if not exists store_referrals_referrer_idx
on public.store_referrals(workspace_id, store_id, referrer_customer_id, created_at desc);

create unique index if not exists store_referrals_order_unique_idx
on public.store_referrals(store_id, referred_order_source, referred_order_id)
where referred_order_source is not null and referred_order_id is not null;

create index if not exists store_orders_referral_id_idx
on public.store_orders(referral_id)
where referral_id is not null;

create index if not exists orders_referral_id_idx
on public.orders(referral_id)
where referral_id is not null;

create or replace function public.set_store_customer_referral_codes_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.code = upper(trim(new.code));
  return new;
end;
$$;

drop trigger if exists store_customer_referral_codes_updated_at on public.store_customer_referral_codes;
create trigger store_customer_referral_codes_updated_at
before insert or update on public.store_customer_referral_codes
for each row execute function public.set_store_customer_referral_codes_updated_at();

create or replace function public.set_store_referrals_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.referral_code = upper(trim(new.referral_code));
  new.referred_email = nullif(lower(trim(coalesce(new.referred_email, ''))), '');
  new.referred_phone = nullif(regexp_replace(coalesce(new.referred_phone, ''), '[^0-9+]', '', 'g'), '');
  return new;
end;
$$;

drop trigger if exists store_referrals_updated_at on public.store_referrals;
create trigger store_referrals_updated_at
before insert or update on public.store_referrals
for each row execute function public.set_store_referrals_updated_at();

alter table public.store_customer_referral_codes enable row level security;
alter table public.store_referrals enable row level security;

drop policy if exists "workspace members read referral codes" on public.store_customer_referral_codes;
drop policy if exists "workspace editors write referral codes" on public.store_customer_referral_codes;
drop policy if exists "workspace members read referrals" on public.store_referrals;
drop policy if exists "workspace editors write referrals" on public.store_referrals;

create policy "workspace members read referral codes"
on public.store_customer_referral_codes for select to authenticated
using (public.can_access_workspace(workspace_id));

create policy "workspace editors write referral codes"
on public.store_customer_referral_codes for all to authenticated
using (public.workspace_can_edit(workspace_id))
with check (public.workspace_can_edit(workspace_id));

create policy "workspace members read referrals"
on public.store_referrals for select to authenticated
using (public.can_access_workspace(workspace_id));

create policy "workspace editors write referrals"
on public.store_referrals for all to authenticated
using (public.workspace_can_edit(workspace_id))
with check (public.workspace_can_edit(workspace_id));
