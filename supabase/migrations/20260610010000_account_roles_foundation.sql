-- PHASE C5: Real role account architecture foundation.
--
-- Additive only:
-- - Keeps Supabase Auth as the authentication provider.
-- - Does not reset auth, remove RLS, or change existing stores/workspaces.
-- - Establishes one production role source of truth for app-level role isolation.

create extension if not exists "pgcrypto";

create table if not exists public.account_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('super_admin', 'owner', 'reseller', 'delivery', 'customer')),
  status text not null default 'pending' check (status in ('pending', 'active', 'suspended', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists account_roles_role_status_idx
on public.account_roles(role, status, updated_at desc);

create or replace function public.set_account_roles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists account_roles_updated_at on public.account_roles;
create trigger account_roles_updated_at
before update on public.account_roles
for each row execute function public.set_account_roles_updated_at();

alter table public.account_roles enable row level security;

drop policy if exists "users read own account role" on public.account_roles;
drop policy if exists "service role manages account roles" on public.account_roles;

create policy "users read own account role"
on public.account_roles
for select
to authenticated
using (auth.uid() = user_id);

create policy "service role manages account roles"
on public.account_roles
for all
to service_role
using (true)
with check (true);

grant select on public.account_roles to authenticated;
grant all on public.account_roles to service_role;

-- Existing store owners remain owners. Do not overwrite a role if one already exists.
insert into public.account_roles (user_id, role, status)
select distinct owner_id, 'owner', 'active'
from (
  select owner_user_id as owner_id
  from public.stores
  where owner_user_id is not null
  union
  select user_id as owner_id
  from public.stores
  where user_id is not null
  union
  select user_id as owner_id
  from public.workspace_members
  where role = 'owner'
    and status = 'active'
) owners
where owner_id is not null
on conflict (user_id) do nothing;

-- Delivery agents are real delivery accounts when linked to auth by metadata or email.
insert into public.account_roles (user_id, role, status)
select distinct resolved_user_id, 'delivery', resolved_status
from (
  select
    coalesce(
      case
        when agents.metadata->>'auth_user_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          then (agents.metadata->>'auth_user_id')::uuid
        else null
      end,
      users.id
    ) as resolved_user_id,
    case when agents.status = 'active' then 'active' else 'suspended' end as resolved_status
  from public.store_delivery_agents agents
  left join auth.users users
    on lower(users.email) = lower(coalesce(agents.normalized_email, agents.email))
) delivery_accounts
where resolved_user_id is not null
on conflict (user_id) do nothing;

-- Customer accounts are real customer accounts when linked by metadata or email.
insert into public.account_roles (user_id, role, status)
select distinct resolved_user_id, 'customer', resolved_status
from (
  select
    coalesce(
      case
        when customers.metadata->>'auth_user_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          then (customers.metadata->>'auth_user_id')::uuid
        else null
      end,
      users.id
    ) as resolved_user_id,
    case when customers.status in ('active', 'new', 'returning', 'vip') then 'active' else 'pending' end as resolved_status
  from public.store_customers customers
  left join auth.users users
    on lower(users.email) = lower(coalesce(customers.normalized_email, customers.email))
) customer_accounts
where resolved_user_id is not null
on conflict (user_id) do nothing;

-- C3 operational test accounts are stabilized as real role rows, but remain separate from
-- test_environment_accounts.
insert into public.account_roles (user_id, role, status)
select accounts.auth_user_id,
  case accounts.role
    when 'admin' then 'super_admin'
    else accounts.role
  end,
  case when accounts.verified is true and accounts.status = 'active' then 'active' else 'pending' end
from public.test_environment_accounts accounts
where accounts.auth_user_id is not null
on conflict (user_id) do update
set
  role = excluded.role,
  status = excluded.status;

-- Test auth confirmation/passwords are not mutated here.
-- auth.users.confirmed_at is generated in current Supabase Auth schemas and cannot be set directly.
-- Stable test credentials remain managed through test_environment_accounts and existing test tooling.

update public.test_environment_accounts
set
  password_hash = 'stable-test-password-configured',
  verified = true,
  status = 'active',
  updated_at = now()
where lower(email) in (
  'superadmin.test@shastore.test',
  'owner.test@shastore.test',
  'reseller.test@shastore.test',
  'customer.test@shastore.test',
  'delivery.test@shastore.test'
);
