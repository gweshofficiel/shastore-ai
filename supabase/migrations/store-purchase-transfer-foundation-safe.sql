-- Store purchase and ownership transfer foundation for SHASTORE AI.
-- Additive only: scoped to reseller ready-made store selling flows.
-- Does not touch auth core, billing, subscriptions, checkout, admin, shipping,
-- template studio, storefront rendering, or reseller showcase route structure.

create table if not exists public.store_purchase_requests (
  id uuid primary key default gen_random_uuid(),
  reseller_id uuid not null references public.reseller_profiles(id) on delete cascade,
  template_id text,
  showcase_item_id uuid not null references public.reseller_showcase_items(id) on delete cascade,
  buyer_name text not null,
  buyer_email text not null,
  buyer_phone text,
  buyer_whatsapp text,
  business_name text not null,
  requested_domain text,
  notes text,
  request_status text not null default 'pending'
    check (request_status in ('pending', 'approved', 'rejected', 'preparing', 'delivered')),
  transfer_code text not null default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)),
  created_at timestamptz not null default now()
);

create table if not exists public.store_transfer_records (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.store_purchase_requests(id) on delete cascade,
  reseller_id uuid not null references public.reseller_profiles(id) on delete cascade,
  buyer_user_id uuid,
  transfer_status text not null default 'not_started'
    check (transfer_status in ('not_started', 'account_pending', 'ownership_pending', 'domain_pending', 'ready', 'completed', 'blocked')),
  delivery_status text not null default 'not_sent'
    check (delivery_status in ('not_sent', 'pdf_pending', 'whatsapp_pending', 'email_pending', 'sent', 'failed')),
  pdf_delivery_placeholder text,
  whatsapp_delivery_placeholder text,
  email_delivery_placeholder text,
  created_at timestamptz not null default now()
);

create unique index if not exists store_purchase_requests_transfer_code_idx
  on public.store_purchase_requests(transfer_code);

create index if not exists store_purchase_requests_reseller_status_idx
  on public.store_purchase_requests(reseller_id, request_status, created_at desc);

create index if not exists store_purchase_requests_showcase_item_idx
  on public.store_purchase_requests(showcase_item_id, created_at desc);

create index if not exists store_transfer_records_reseller_idx
  on public.store_transfer_records(reseller_id, created_at desc);

alter table public.store_purchase_requests enable row level security;
alter table public.store_transfer_records enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'store_purchase_requests'
      and policyname = 'Public buyers create store purchase requests'
  ) then
    create policy "Public buyers create store purchase requests"
      on public.store_purchase_requests for insert
      with check (
        request_status = 'pending'
        and exists (
          select 1
          from public.reseller_showcase_items items
          join public.reseller_profiles profiles on profiles.id = items.profile_id
          where items.id = store_purchase_requests.showcase_item_id
            and items.profile_id = store_purchase_requests.reseller_id
            and items.status = 'published'
            and profiles.is_published = true
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'store_purchase_requests'
      and policyname = 'Resellers manage own store purchase requests'
  ) then
    create policy "Resellers manage own store purchase requests"
      on public.store_purchase_requests for all
      using (
        exists (
          select 1
          from public.reseller_profiles profiles
          where profiles.id = store_purchase_requests.reseller_id
            and profiles.user_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1
          from public.reseller_profiles profiles
          where profiles.id = store_purchase_requests.reseller_id
            and profiles.user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'store_purchase_requests'
      and policyname = 'Admins read all store purchase requests'
  ) then
    create policy "Admins read all store purchase requests"
      on public.store_purchase_requests for select
      using (
        coalesce(auth.jwt() ->> 'role', '') = 'admin'
        or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'store_transfer_records'
      and policyname = 'Resellers manage own store transfer records'
  ) then
    create policy "Resellers manage own store transfer records"
      on public.store_transfer_records for all
      using (
        exists (
          select 1
          from public.reseller_profiles profiles
          where profiles.id = store_transfer_records.reseller_id
            and profiles.user_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1
          from public.reseller_profiles profiles
          where profiles.id = store_transfer_records.reseller_id
            and profiles.user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'store_transfer_records'
      and policyname = 'Admins read all store transfer records'
  ) then
    create policy "Admins read all store transfer records"
      on public.store_transfer_records for select
      using (
        coalesce(auth.jwt() ->> 'role', '') = 'admin'
        or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
      );
  end if;
end $$;
