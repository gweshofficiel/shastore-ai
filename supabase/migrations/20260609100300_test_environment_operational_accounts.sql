-- Operational SHASTORE test environment accounts.
-- Additive only: keeps existing auth, workspace, store, payment, and RLS systems intact.

create table if not exists public.test_environment_accounts (
  id uuid primary key default gen_random_uuid(),
  role text not null check (role in ('admin', 'owner', 'reseller', 'customer', 'delivery')),
  email text not null unique,
  password_hash text,
  auth_user_id uuid unique,
  verified boolean not null default false,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  last_login_at timestamptz,
  updated_at timestamptz not null default now()
);

create unique index if not exists test_environment_accounts_role_idx
on public.test_environment_accounts(role);

create index if not exists test_environment_accounts_auth_user_idx
on public.test_environment_accounts(auth_user_id);

create table if not exists public.test_environment_audit_logs (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references public.test_environment_accounts(id) on delete set null,
  auth_user_id uuid,
  actor_user_id uuid,
  event_type text not null check (event_type in ('account_creation', 'password_reset', 'impersonation', 'login', 'logout', 'deactivation', 'status_refresh')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists test_environment_audit_logs_account_idx
on public.test_environment_audit_logs(account_id, created_at desc);

create index if not exists test_environment_audit_logs_auth_user_idx
on public.test_environment_audit_logs(auth_user_id, created_at desc);

alter table public.test_environment_accounts enable row level security;
alter table public.test_environment_audit_logs enable row level security;

drop policy if exists "service role manages test environment accounts" on public.test_environment_accounts;
drop policy if exists "service role manages test environment audit logs" on public.test_environment_audit_logs;

create policy "service role manages test environment accounts"
on public.test_environment_accounts
for all
to service_role
using (true)
with check (true);

create policy "service role manages test environment audit logs"
on public.test_environment_audit_logs
for all
to service_role
using (true)
with check (true);

grant all on public.test_environment_accounts to service_role;
grant all on public.test_environment_audit_logs to service_role;
