-- Secure workspace invitation tokens.
-- Additive: keeps the earlier workspace_invites placeholder table untouched while moving
-- production invite acceptance to workspace_invitations with token_hash only.

create table if not exists public.workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  email text not null,
  role text not null check (role in ('admin', 'editor', 'support')),
  invited_by uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (workspace_id, email)
);

create index if not exists workspace_invitations_workspace_idx
  on public.workspace_invitations(workspace_id, status, created_at desc);

create index if not exists workspace_invitations_email_idx
  on public.workspace_invitations(lower(email), status);

create index if not exists workspace_invitations_token_hash_idx
  on public.workspace_invitations(token_hash);

create or replace function public.shastore_is_admin()
returns boolean
language sql
stable
as $$
  select
    coalesce(auth.jwt() ->> 'role', '') = 'admin'
    or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
    or coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'admin';
$$;

alter table public.workspace_invitations enable row level security;

drop policy if exists "workspace managers can create invitations" on public.workspace_invitations;
drop policy if exists "workspace managers can update invitations" on public.workspace_invitations;
drop policy if exists "workspace managers can delete invitations" on public.workspace_invitations;
drop policy if exists "workspace members can read workspace invitations" on public.workspace_invitations;
drop policy if exists "invited users can read own invitations" on public.workspace_invitations;

create policy "workspace members can read workspace invitations"
on public.workspace_invitations
for select
to authenticated
using (public.can_access_workspace(workspace_id));

create policy "invited users can read own invitations"
on public.workspace_invitations
for select
to authenticated
using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

create policy "workspace managers can create invitations"
on public.workspace_invitations
for insert
to authenticated
with check (public.can_manage_workspace(workspace_id));

create policy "workspace managers can update invitations"
on public.workspace_invitations
for update
to authenticated
using (public.can_manage_workspace(workspace_id))
with check (public.can_manage_workspace(workspace_id));

create policy "workspace managers can delete invitations"
on public.workspace_invitations
for delete
to authenticated
using (public.can_manage_workspace(workspace_id));
