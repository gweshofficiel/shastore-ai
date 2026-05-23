-- SHASTORE AI - Production domains and publishing foundation
-- Idempotent and domain/publishing-only. Does not alter billing, checkout, analytics, orders, templates, stores, or auth logic.

create extension if not exists "pgcrypto";

do $$
begin
  create type domain_kind as enum ('free_subdomain', 'custom_domain', 'branded_domain');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type domain_status as enum ('pending', 'verified', 'failed');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type ssl_status as enum ('pending', 'ready', 'failed');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type publication_source_type as enum ('landing', 'store');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.domains (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  hostname text not null unique,
  kind domain_kind not null default 'free_subdomain',
  status domain_status not null default 'pending',
  ssl_status ssl_status not null default 'pending',
  verification_token text not null default md5(random()::text || clock_timestamp()::text),
  dns_target text not null default 'cname.hostinsh.shastore.ai',
  nameserver_instructions jsonb not null default '[]'::jsonb,
  hostinsh_zone_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.publication_hosts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  domain_id uuid references public.domains(id) on delete set null,
  hostname text not null unique,
  source_type publication_source_type not null,
  source_slug text not null,
  publication_url text not null,
  status text not null default 'draft',
  seo_title text,
  seo_description text,
  canonical_url text,
  sitemap_enabled boolean not null default true,
  robots_indexable boolean not null default true,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dns_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  domain_id uuid not null references public.domains(id) on delete cascade,
  hostname text not null,
  record_type text not null default 'TXT',
  record_name text not null,
  record_value text not null,
  status domain_status not null default 'pending',
  checked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.publish_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_type publication_source_type not null,
  source_slug text not null,
  hostname text,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.domains enable row level security;
alter table public.publication_hosts enable row level security;
alter table public.dns_verifications enable row level security;
alter table public.publish_events enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'domains'
      and policyname = 'Users read own domains'
  ) then
    create policy "Users read own domains" on public.domains
      for select using (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'domains'
      and policyname = 'Users insert own domains'
  ) then
    create policy "Users insert own domains" on public.domains
      for insert with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'domains'
      and policyname = 'Users update own domains'
  ) then
    create policy "Users update own domains" on public.domains
      for update using (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'publication_hosts'
      and policyname = 'Users read own publication hosts'
  ) then
    create policy "Users read own publication hosts" on public.publication_hosts
      for select using (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'publication_hosts'
      and policyname = 'Users insert own publication hosts'
  ) then
    create policy "Users insert own publication hosts" on public.publication_hosts
      for insert with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'publication_hosts'
      and policyname = 'Users update own publication hosts'
  ) then
    create policy "Users update own publication hosts" on public.publication_hosts
      for update using (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'dns_verifications'
      and policyname = 'Users read own DNS verifications'
  ) then
    create policy "Users read own DNS verifications" on public.dns_verifications
      for select using (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'dns_verifications'
      and policyname = 'Users insert own DNS verifications'
  ) then
    create policy "Users insert own DNS verifications" on public.dns_verifications
      for insert with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'dns_verifications'
      and policyname = 'Users update own DNS verifications'
  ) then
    create policy "Users update own DNS verifications" on public.dns_verifications
      for update using (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'publish_events'
      and policyname = 'Users read own publish events'
  ) then
    create policy "Users read own publish events" on public.publish_events
      for select using (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'publish_events'
      and policyname = 'Users insert own publish events'
  ) then
    create policy "Users insert own publish events" on public.publish_events
      for insert with check (auth.uid() = user_id);
  end if;
end $$;

create index if not exists domains_user_id_idx on public.domains(user_id);
create index if not exists domains_hostname_idx on public.domains(hostname);
create index if not exists publication_hosts_user_id_idx on public.publication_hosts(user_id);
create index if not exists publication_hosts_hostname_idx on public.publication_hosts(hostname);
create index if not exists publication_hosts_source_idx on public.publication_hosts(source_type, source_slug);
create index if not exists dns_verifications_domain_id_idx on public.dns_verifications(domain_id);
create index if not exists publish_events_user_source_idx on public.publish_events(user_id, source_type, source_slug);

create or replace function public.resolve_publication_hostname(input_hostname text)
returns table (
  hostname text,
  source_type publication_source_type,
  source_slug text,
  publication_url text,
  canonical_url text
)
language sql
stable
as $$
  select
    ph.hostname,
    ph.source_type,
    ph.source_slug,
    ph.publication_url,
    ph.canonical_url
  from public.publication_hosts ph
  where ph.hostname = lower(input_hostname)
    and ph.status = 'published'
  limit 1;
$$;

