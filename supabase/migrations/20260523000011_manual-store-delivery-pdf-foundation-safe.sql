-- Manual store delivery PDF test foundation for SHASTORE AI.
-- Additive only: manual reseller/admin download flow. Does not send email,
-- create payments, or touch billing, checkout, shipping, template studio, or auth core.

create table if not exists public.store_delivery_documents (
  id uuid primary key default gen_random_uuid(),
  purchase_request_id uuid not null unique references public.store_purchase_requests(id) on delete cascade,
  provisioned_store_id uuid references public.provisioned_stores(id) on delete set null,
  store_instance_id uuid not null references public.store_instances(id) on delete cascade,
  reseller_id uuid not null references public.reseller_profiles(id) on delete cascade,
  document_status text not null default 'delivery_pdf_generated'
    check (document_status in ('delivery_pdf_generated', 'manual_delivery_ready')),
  pdf_payload jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists store_delivery_documents_reseller_idx
  on public.store_delivery_documents(reseller_id, generated_at desc);

alter table public.store_delivery_documents enable row level security;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'store_transfers'
  ) then
    alter table public.store_transfers
      drop constraint if exists store_transfers_delivery_status_check;

    alter table public.store_transfers
      add constraint store_transfers_delivery_status_check
      check (
        delivery_status in (
          'not_sent',
          'ready_for_delivery',
          'delivery_pdf_generated',
          'manual_delivery_ready',
          'delivered',
          'failed'
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'store_delivery_documents'
      and policyname = 'Resellers manage own store delivery documents'
  ) then
    create policy "Resellers manage own store delivery documents"
      on public.store_delivery_documents for all
      using (
        exists (
          select 1
          from public.reseller_profiles profiles
          where profiles.id = store_delivery_documents.reseller_id
            and profiles.user_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1
          from public.reseller_profiles profiles
          where profiles.id = store_delivery_documents.reseller_id
            and profiles.user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'store_delivery_documents'
      and policyname = 'Admins read all store delivery documents'
  ) then
    create policy "Admins read all store delivery documents"
      on public.store_delivery_documents for select
      using (
        coalesce(auth.jwt() ->> 'role', '') = 'admin'
        or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
      );
  end if;
end $$;

create or replace function public.set_store_delivery_documents_updated_at()
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
  if not exists (select 1 from pg_trigger where tgname = 'store_delivery_documents_updated_at') then
    create trigger store_delivery_documents_updated_at
      before update on public.store_delivery_documents
      for each row execute function public.set_store_delivery_documents_updated_at();
  end if;
end $$;

