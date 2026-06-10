-- PHASE C5: Independent delivery profile foundation.
--
-- Additive only:
-- - Delivery users can exist independently from owner stores.
-- - Store assignment invitations are separate from the delivery profile.
-- - No delivery agent is automatically assigned to any store.

create extension if not exists "pgcrypto";

create table if not exists public.delivery_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  email text not null,
  name text,
  phone text,
  country text,
  city text,
  region text,
  zone text,
  type text not null default 'individual' check (type in ('individual', 'company')),
  status text not null default 'pending' check (status in ('pending', 'active', 'suspended')),
  verification_status text not null default 'pending' check (verification_status in ('pending', 'verified', 'rejected')),
  reputation_score numeric(8, 2) not null default 0 check (reputation_score >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists delivery_profiles_email_unique_idx
on public.delivery_profiles(lower(email));

create index if not exists delivery_profiles_marketplace_filter_idx
on public.delivery_profiles(country, city, region, zone, status, verification_status, reputation_score desc);

create table if not exists public.delivery_store_assignments (
  id uuid primary key default gen_random_uuid(),
  delivery_profile_id uuid not null references public.delivery_profiles(id) on delete cascade,
  delivery_user_id uuid not null references auth.users(id) on delete cascade,
  owner_user_id uuid references auth.users(id) on delete set null,
  workspace_id uuid,
  store_id uuid references public.stores(id) on delete cascade,
  status text not null default 'invited' check (status in ('invited', 'accepted', 'declined', 'revoked')),
  invited_at timestamptz not null default now(),
  responded_at timestamptz,
  accepted_at timestamptz,
  revoked_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint delivery_store_assignments_response_check check (
    (status = 'accepted' and accepted_at is not null)
    or (status <> 'accepted')
  )
);

create unique index if not exists delivery_store_assignments_profile_store_unique_idx
on public.delivery_store_assignments(delivery_profile_id, store_id)
where store_id is not null and status in ('invited', 'accepted');

create index if not exists delivery_store_assignments_delivery_idx
on public.delivery_store_assignments(delivery_user_id, status, updated_at desc);

create index if not exists delivery_store_assignments_store_idx
on public.delivery_store_assignments(workspace_id, store_id, status, updated_at desc);

create or replace function public.set_delivery_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.email = lower(trim(new.email));
  new.name = nullif(trim(coalesce(new.name, '')), '');
  new.phone = nullif(trim(coalesce(new.phone, '')), '');
  new.country = nullif(trim(coalesce(new.country, '')), '');
  new.city = nullif(trim(coalesce(new.city, '')), '');
  new.region = nullif(trim(coalesce(new.region, '')), '');
  new.zone = nullif(trim(coalesce(new.zone, '')), '');
  return new;
end;
$$;

drop trigger if exists delivery_profiles_updated_at on public.delivery_profiles;
create trigger delivery_profiles_updated_at
before insert or update on public.delivery_profiles
for each row execute function public.set_delivery_profiles_updated_at();

create or replace function public.set_delivery_store_assignments_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  if new.status in ('accepted', 'declined') and new.responded_at is null then
    new.responded_at = now();
  end if;
  if new.status = 'accepted' and new.accepted_at is null then
    new.accepted_at = now();
  end if;
  if new.status = 'revoked' and new.revoked_at is null then
    new.revoked_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists delivery_store_assignments_updated_at on public.delivery_store_assignments;
create trigger delivery_store_assignments_updated_at
before insert or update on public.delivery_store_assignments
for each row execute function public.set_delivery_store_assignments_updated_at();

alter table public.delivery_profiles enable row level security;
alter table public.delivery_store_assignments enable row level security;

drop policy if exists "delivery users read own profile" on public.delivery_profiles;
drop policy if exists "delivery users update own profile" on public.delivery_profiles;
drop policy if exists "authenticated read active delivery profiles" on public.delivery_profiles;
drop policy if exists "service role manages delivery profiles" on public.delivery_profiles;

create policy "delivery users read own profile"
on public.delivery_profiles for select to authenticated
using (auth.uid() = user_id);

create policy "delivery users update own profile"
on public.delivery_profiles for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "authenticated read active delivery profiles"
on public.delivery_profiles for select to authenticated
using (status = 'active' and verification_status = 'verified');

create policy "service role manages delivery profiles"
on public.delivery_profiles for all to service_role
using (true)
with check (true);

drop policy if exists "delivery users read own store assignments" on public.delivery_store_assignments;
drop policy if exists "delivery users respond to own invitations" on public.delivery_store_assignments;
drop policy if exists "workspace editors manage delivery invitations" on public.delivery_store_assignments;
drop policy if exists "service role manages delivery store assignments" on public.delivery_store_assignments;

create policy "delivery users read own store assignments"
on public.delivery_store_assignments for select to authenticated
using (auth.uid() = delivery_user_id);

create policy "delivery users respond to own invitations"
on public.delivery_store_assignments for update to authenticated
using (auth.uid() = delivery_user_id)
with check (
  auth.uid() = delivery_user_id
  and status in ('accepted', 'declined')
);

create policy "workspace editors manage delivery invitations"
on public.delivery_store_assignments for all to authenticated
using (workspace_id is not null and public.workspace_can_edit(workspace_id))
with check (workspace_id is not null and public.workspace_can_edit(workspace_id));

create policy "service role manages delivery store assignments"
on public.delivery_store_assignments for all to service_role
using (true)
with check (true);

grant select, update on public.delivery_profiles to authenticated;
grant select, update on public.delivery_store_assignments to authenticated;
grant all on public.delivery_profiles to service_role;
grant all on public.delivery_store_assignments to service_role;

-- Backfill independent profiles for existing delivery role users without assigning stores.
insert into public.delivery_profiles (user_id, email, name, status, verification_status)
select
  roles.user_id,
  lower(users.email),
  coalesce(users.raw_user_meta_data->>'name', users.raw_user_meta_data->>'full_name', split_part(users.email, '@', 1)),
  case when roles.status = 'active' then 'active' else 'pending' end,
  'pending'
from public.account_roles roles
join auth.users users on users.id = roles.user_id
where roles.role = 'delivery'
  and users.email is not null
on conflict (user_id) do nothing;
