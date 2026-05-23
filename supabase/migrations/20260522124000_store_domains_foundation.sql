-- Store domains and subdomains foundation for buyer-owned stores.
-- Additive only: does not alter products, orders, customers, checkout, reseller, or provisioning flows.

create extension if not exists "pgcrypto";

create table if not exists public.store_domains (
  id uuid primary key default gen_random_uuid(),
  store_instance_id uuid not null references public.store_instances(id) on delete cascade,
  owner_user_id uuid references auth.users(id) on delete cascade,
  domain_type text not null default 'subdomain'
    check (domain_type in ('subdomain', 'custom')),
  hostname text not null,
  subdomain text,
  custom_domain text,
  primary_domain text,
  is_primary boolean not null default false,
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'verified', 'failed', 'revoked')),
  dns_status text not null default 'pending'
    check (dns_status in ('not_configured', 'pending', 'verified', 'failed')),
  ssl_status text not null default 'pending'
    check (ssl_status in ('not_configured', 'pending', 'ready', 'active', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.store_domains
  add column if not exists owner_user_id uuid references auth.users(id) on delete cascade,
  add column if not exists subdomain text,
  add column if not exists custom_domain text,
  add column if not exists primary_domain text,
  add column if not exists is_primary boolean not null default false,
  add column if not exists verification_status text not null default 'pending',
  add column if not exists dns_status text not null default 'pending',
  add column if not exists ssl_status text not null default 'pending';

update public.store_domains domains
set owner_user_id = instances.owner_user_id
from public.store_instances instances
where domains.store_instance_id = instances.id
  and domains.owner_user_id is null;

update public.store_domains
set primary_domain = hostname
where primary_domain is null;

update public.store_domains
set subdomain = split_part(hostname, '.', 1)
where domain_type = 'subdomain'
  and subdomain is null;

update public.store_domains
set custom_domain = hostname
where domain_type = 'custom'
  and custom_domain is null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'store_domains_hostname_format_check'
      and conrelid = 'public.store_domains'::regclass
  ) then
    alter table public.store_domains
      add constraint store_domains_hostname_format_check
      check (
        hostname ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$'
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'store_domains_domain_type_shape_check'
      and conrelid = 'public.store_domains'::regclass
  ) then
    alter table public.store_domains
      add constraint store_domains_domain_type_shape_check
      check (
        (domain_type = 'subdomain' and subdomain is not null)
        or (domain_type = 'custom' and custom_domain is not null)
      );
  end if;
end $$;

create unique index if not exists store_domains_hostname_unique_idx
  on public.store_domains(lower(hostname));

create unique index if not exists store_domains_instance_hostname_idx
  on public.store_domains(store_instance_id, hostname);

create unique index if not exists store_domains_one_primary_idx
  on public.store_domains(store_instance_id)
  where is_primary;

create index if not exists store_domains_owner_idx
  on public.store_domains(owner_user_id, created_at desc);

create index if not exists store_domains_instance_idx
  on public.store_domains(store_instance_id, created_at desc);

alter table public.store_domains enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'store_domains'
      and policyname = 'Buyer store members read store domains'
  ) then
    create policy "Buyer store members read store domains"
      on public.store_domains for select
      using (public.can_access_store_instance(store_instance_id));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'store_domains'
      and policyname = 'Buyer store managers write store domains'
  ) then
    create policy "Buyer store managers write store domains"
      on public.store_domains for all
      using (public.can_manage_store_instance(store_instance_id))
      with check (public.can_manage_store_instance(store_instance_id));
  end if;
end $$;

create or replace function public.set_store_domains_updated_at()
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
  if not exists (select 1 from pg_trigger where tgname = 'store_domains_updated_at') then
    create trigger store_domains_updated_at
      before update on public.store_domains
      for each row execute function public.set_store_domains_updated_at();
  end if;
end $$;

create or replace function public.resolve_storefront_hostname(candidate_hostname text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  normalized_hostname text := lower(trim(coalesce(candidate_hostname, '')));
  resolved_slug text;
begin
  if normalized_hostname = '' then
    return null;
  end if;

  select coalesce(settings.store_slug, instances.internal_slug)
    into resolved_slug
  from public.store_domains domains
  join public.store_instances instances
    on instances.id = domains.store_instance_id
  left join public.store_settings settings
    on settings.store_instance_id = instances.id
  where lower(domains.hostname) = normalized_hostname
    and domains.is_primary = true
    and domains.verification_status = 'verified'
    and domains.ssl_status in ('ready', 'active')
    and instances.visibility = 'public'
  limit 1;

  return resolved_slug;
end;
$$;

grant execute on function public.resolve_storefront_hostname(text) to anon;
grant execute on function public.resolve_storefront_hostname(text) to authenticated;

