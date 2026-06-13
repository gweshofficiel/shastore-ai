-- Domain DNS records runtime foundation.
-- Additive only: stores DNS instructions/status for existing domain_orders.
-- No provider DNS writes, SSL automation, email provisioning, hosting, payments, or RLS weakening.

create extension if not exists "pgcrypto";

create table if not exists public.domain_dns_records (
  id uuid primary key default gen_random_uuid(),
  domain_order_id uuid not null references public.domain_orders(id) on delete cascade,
  domain_name text not null,
  record_type text not null,
  name text not null,
  value text not null,
  ttl integer not null default 3600,
  priority integer,
  status text not null default 'pending',
  verification_status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'domain_dns_records_status_check'
      and conrelid = 'public.domain_dns_records'::regclass
  ) then
    alter table public.domain_dns_records
      add constraint domain_dns_records_status_check
      check (status in ('pending', 'configured', 'verified', 'failed'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'domain_dns_records_verification_status_check'
      and conrelid = 'public.domain_dns_records'::regclass
  ) then
    alter table public.domain_dns_records
      add constraint domain_dns_records_verification_status_check
      check (verification_status in ('pending', 'configured', 'verified', 'failed'));
  end if;
end $$;

create unique index if not exists domain_dns_records_order_type_name_idx
on public.domain_dns_records(domain_order_id, record_type, name);

create index if not exists domain_dns_records_order_updated_idx
on public.domain_dns_records(domain_order_id, updated_at desc);

create index if not exists domain_dns_records_domain_name_idx
on public.domain_dns_records(lower(domain_name));

create or replace function public.set_domain_dns_records_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_domain_dns_records_updated_at on public.domain_dns_records;
create trigger set_domain_dns_records_updated_at
before update on public.domain_dns_records
for each row
execute function public.set_domain_dns_records_updated_at();

alter table public.domain_dns_records enable row level security;

drop policy if exists "store members read domain dns records" on public.domain_dns_records;
create policy "store members read domain dns records"
on public.domain_dns_records
for select
to authenticated
using (
  exists (
    select 1
    from public.domain_orders o
    where o.id = domain_dns_records.domain_order_id
      and (
        public.can_access_store_instance(o.store_id)
        or exists (
          select 1
          from public.stores s
          where s.id = o.store_id
            and (
              public.can_access_workspace(s.workspace_id)
              or auth.uid() = s.owner_user_id
              or auth.uid() = s.user_id
            )
        )
      )
  )
);

drop policy if exists "service role can manage domain dns records" on public.domain_dns_records;
create policy "service role can manage domain dns records"
on public.domain_dns_records
for all
to service_role
using (true)
with check (true);
