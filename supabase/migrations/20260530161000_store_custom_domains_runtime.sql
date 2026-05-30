-- Store custom domains runtime.
-- Additive only: reuses store_domains when present and preserves default store URLs.

create extension if not exists "pgcrypto";

create table if not exists public.store_domains (
  id uuid primary key default gen_random_uuid(),
  store_instance_id uuid not null,
  owner_user_id uuid references auth.users(id) on delete cascade,
  domain_type text not null default 'subdomain',
  hostname text not null,
  subdomain text,
  custom_domain text,
  primary_domain text,
  is_primary boolean not null default false,
  verification_status text not null default 'pending',
  dns_status text not null default 'pending',
  ssl_status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.store_domains
  add column if not exists store_id uuid,
  add column if not exists workspace_id uuid,
  add column if not exists status text not null default 'pending',
  add column if not exists verification_token text not null default encode(gen_random_bytes(24), 'hex'),
  add column if not exists cname_target text not null default 'cname.hostinsh.shastore.ai',
  add column if not exists verified_at timestamptz,
  add column if not exists last_checked_at timestamptz,
  add column if not exists error_message text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

update public.store_domains
set store_id = coalesce(store_id, store_instance_id)
where store_id is null;

update public.store_domains
set status = case
  when domain_type = 'subdomain' and verification_status = 'verified' then 'active'
  when verification_status = 'verified' and ssl_status in ('ready', 'active') then 'active'
  when verification_status = 'verified' then 'verified'
  when verification_status = 'failed' or dns_status = 'failed' or ssl_status = 'failed' then 'failed'
  else status
end;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'store_domains_runtime_status_check'
      and conrelid = 'public.store_domains'::regclass
  ) then
    alter table public.store_domains
      add constraint store_domains_runtime_status_check
      check (status in ('pending', 'verifying', 'verified', 'active', 'failed'));
  end if;
end $$;

create unique index if not exists store_domains_hostname_unique_idx
on public.store_domains(lower(hostname));

create unique index if not exists store_domains_instance_hostname_idx
on public.store_domains(store_instance_id, hostname);

create index if not exists store_domains_runtime_status_idx
on public.store_domains(status, updated_at desc);

create table if not exists public.store_domain_verification_logs (
  id uuid primary key default gen_random_uuid(),
  store_domain_id uuid references public.store_domains(id) on delete cascade,
  store_instance_id uuid,
  workspace_id uuid,
  owner_user_id uuid,
  hostname text not null,
  status text not null,
  message text,
  checked_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists store_domain_verification_logs_domain_checked_idx
on public.store_domain_verification_logs(store_domain_id, checked_at desc);

create index if not exists store_domain_verification_logs_store_checked_idx
on public.store_domain_verification_logs(store_instance_id, checked_at desc);

alter table public.store_domains enable row level security;
alter table public.store_domain_verification_logs enable row level security;

drop policy if exists "Buyer store members read store domains" on public.store_domains;
create policy "Buyer store members read store domains"
on public.store_domains
for select
to authenticated
using (public.can_access_store_instance(store_instance_id));

drop policy if exists "Buyer store managers write store domains" on public.store_domains;
create policy "Buyer store managers write store domains"
on public.store_domains
for all
to authenticated
using (public.can_manage_store_instance(store_instance_id))
with check (public.can_manage_store_instance(store_instance_id));

drop policy if exists "Buyer store members read store domain verification logs" on public.store_domain_verification_logs;
create policy "Buyer store members read store domain verification logs"
on public.store_domain_verification_logs
for select
to authenticated
using (public.can_access_store_instance(store_instance_id));

drop policy if exists "Buyer store managers write store domain verification logs" on public.store_domain_verification_logs;
create policy "Buyer store managers write store domain verification logs"
on public.store_domain_verification_logs
for insert
to authenticated
with check (public.can_manage_store_instance(store_instance_id));

drop policy if exists "service role can manage store domain verification logs" on public.store_domain_verification_logs;
create policy "service role can manage store domain verification logs"
on public.store_domain_verification_logs
for all
to service_role
using (true)
with check (true);

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
    and (
      domains.status = 'active'
      or (
        domains.verification_status = 'verified'
        and domains.ssl_status in ('ready', 'active')
      )
    )
    and instances.visibility = 'public'
  limit 1;

  if resolved_slug is not null then
    return resolved_slug;
  end if;

  if to_regclass('public.published_stores') is not null then
    select ps.slug
      into resolved_slug
    from public.published_stores ps
    where lower(ps.custom_domain) = normalized_hostname
      and ps.status = 'published'
      and coalesce(ps.visibility, 'public') = 'public'
      and ps.domain_status in ('connected', 'active')
    limit 1;
  end if;

  return resolved_slug;
end;
$$;

grant execute on function public.resolve_storefront_hostname(text) to anon;
grant execute on function public.resolve_storefront_hostname(text) to authenticated;
