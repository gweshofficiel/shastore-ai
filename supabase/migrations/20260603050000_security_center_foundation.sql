-- Security Center foundation (store-scoped settings + session tracking).
-- Additive only: preserves existing auth, RLS, and audit tables.

alter table public.stores
  add column if not exists security_settings jsonb not null default '{}'::jsonb;

create table if not exists public.store_security_sessions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  store_id uuid null references public.stores(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  actor_email text null,
  ip_address text null,
  user_agent text null,
  device_label text null,
  browser_label text null,
  is_active boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  revoked_at timestamptz null
);

create index if not exists store_security_sessions_workspace_active_idx
on public.store_security_sessions(workspace_id, is_active, last_seen_at desc);

create index if not exists store_security_sessions_store_active_idx
on public.store_security_sessions(store_id, is_active, last_seen_at desc)
where store_id is not null;

create index if not exists store_security_sessions_user_active_idx
on public.store_security_sessions(user_id, is_active, last_seen_at desc);

alter table public.store_security_sessions enable row level security;

drop policy if exists "store security sessions workspace members read" on public.store_security_sessions;
drop policy if exists "store security sessions service role manages" on public.store_security_sessions;

create policy "store security sessions workspace members read"
on public.store_security_sessions
for select
to authenticated
using (public.can_access_workspace(workspace_id));

create policy "store security sessions service role manages"
on public.store_security_sessions
for all
to service_role
using (true)
with check (true);

grant select on public.store_security_sessions to authenticated;
grant all on public.store_security_sessions to service_role;
