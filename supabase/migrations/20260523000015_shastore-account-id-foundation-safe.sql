-- SHASTORE account ID foundation for buyer/reseller store ownership targeting.
-- Additive only: does not touch billing, Stripe subscriptions, checkout core,
-- payments, shipping, template studio editor, public storefront rendering,
-- reseller showcase rendering, admin billing, auth core architecture, or domain core.

create table if not exists public.account_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id text not null unique,
  account_type text not null check (account_type in ('user', 'reseller', 'admin')),
  display_name text,
  email text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, account_type)
);

create index if not exists account_profiles_user_type_idx
  on public.account_profiles(user_id, account_type);

alter table public.account_profiles enable row level security;

alter table public.store_purchase_requests
  add column if not exists buyer_has_account boolean not null default false,
  add column if not exists target_account_id text,
  add column if not exists target_account_lookup_status text not null default 'new_account_placeholder'
    check (
      target_account_lookup_status in (
        'new_account_placeholder',
        'exists',
        'not_found',
        'invalid_format',
        'invalid_account_type'
      )
    ),
  add column if not exists buyer_account_type_target text not null default 'user'
    check (buyer_account_type_target in ('user'));

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'account_profiles'
      and policyname = 'Users view own account profiles'
  ) then
    create policy "Users view own account profiles"
      on public.account_profiles for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'account_profiles'
      and policyname = 'Users create own account profiles'
  ) then
    create policy "Users create own account profiles"
      on public.account_profiles for insert
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'account_profiles'
      and policyname = 'Users update own account profile details'
  ) then
    create policy "Users update own account profile details"
      on public.account_profiles for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id and account_id = account_profiles.account_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'account_profiles'
      and policyname = 'Admins read all account profiles'
  ) then
    create policy "Admins read all account profiles"
      on public.account_profiles for select
      using (
        coalesce(auth.jwt() ->> 'role', '') = 'admin'
        or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
      );
  end if;
end $$;

create or replace function public.lookup_shastore_account_id(candidate_account_id text)
returns table (
  lookup_status text,
  account_type text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized text := upper(trim(coalesce(candidate_account_id, '')));
  found_type text;
begin
  if normalized !~ '^SHA[0-9]{9}U$' then
    lookup_status := 'invalid_format';
    account_type := null;
    return next;
    return;
  end if;

  select ap.account_type
    into found_type
  from public.account_profiles ap
  where ap.account_id = normalized
  limit 1;

  if found_type is null then
    lookup_status := 'not_found';
    account_type := null;
    return next;
    return;
  end if;

  if found_type <> 'user' then
    lookup_status := 'invalid_account_type';
    account_type := found_type;
    return next;
    return;
  end if;

  lookup_status := 'exists';
  account_type := found_type;
  return next;
end;
$$;

create or replace function public.set_account_profiles_updated_at()
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
  if not exists (select 1 from pg_trigger where tgname = 'account_profiles_updated_at') then
    create trigger account_profiles_updated_at
      before update on public.account_profiles
      for each row execute function public.set_account_profiles_updated_at();
  end if;
end $$;

