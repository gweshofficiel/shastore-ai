-- Workspace team members foundation.
-- Safe additive migration for owner-based workspaces. Pending email invites are stored
-- separately so invitation creation does not require the invitee to already have auth.

create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'editor', 'support')),
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create table if not exists public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  email text not null,
  role text not null check (role in ('admin', 'editor', 'support')),
  invited_by uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  unique (workspace_id, email)
);

create index if not exists workspace_members_workspace_idx
  on public.workspace_members(workspace_id, role, created_at desc);

create index if not exists workspace_members_user_idx
  on public.workspace_members(user_id, created_at desc);

create index if not exists workspace_invites_workspace_idx
  on public.workspace_invites(workspace_id, status, created_at desc);

create index if not exists workspace_invites_email_idx
  on public.workspace_invites(lower(email), status);

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

insert into public.workspace_members (workspace_id, user_id, role, invited_by)
select distinct stores.workspace_id, stores.owner_user_id, 'owner', stores.owner_user_id
from public.stores stores
where stores.workspace_id is not null
  and stores.owner_user_id is not null
on conflict (workspace_id, user_id) do nothing;

create or replace function public.workspace_member_role(candidate_workspace_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select members.role
  from public.workspace_members members
  where members.workspace_id = candidate_workspace_id
    and members.user_id = auth.uid()
  order by case members.role
    when 'owner' then 1
    when 'admin' then 2
    when 'editor' then 3
    when 'support' then 4
    else 5
  end
  limit 1;
$$;

create or replace function public.can_access_workspace(candidate_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members members
    where members.workspace_id = candidate_workspace_id
      and members.user_id = auth.uid()
  )
  or public.shastore_is_admin();
$$;

create or replace function public.can_manage_workspace(candidate_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.workspace_member_role(candidate_workspace_id), '') in ('owner', 'admin')
    or public.shastore_is_admin();
$$;

alter table public.workspace_members enable row level security;
alter table public.workspace_invites enable row level security;

drop policy if exists "workspace members can read own workspace members" on public.workspace_members;
drop policy if exists "workspace managers can insert members" on public.workspace_members;
drop policy if exists "workspace managers can update members" on public.workspace_members;
drop policy if exists "workspace managers can delete members" on public.workspace_members;

create policy "workspace members can read own workspace members"
on public.workspace_members
for select
to authenticated
using (public.can_access_workspace(workspace_id));

create policy "workspace managers can insert members"
on public.workspace_members
for insert
to authenticated
with check (public.can_manage_workspace(workspace_id));

create policy "workspace managers can update members"
on public.workspace_members
for update
to authenticated
using (public.can_manage_workspace(workspace_id))
with check (public.can_manage_workspace(workspace_id));

create policy "workspace managers can delete members"
on public.workspace_members
for delete
to authenticated
using (public.can_manage_workspace(workspace_id) and role <> 'owner');

drop policy if exists "workspace members can read own workspace invites" on public.workspace_invites;
drop policy if exists "workspace managers can create invites" on public.workspace_invites;
drop policy if exists "workspace managers can update invites" on public.workspace_invites;
drop policy if exists "workspace managers can delete invites" on public.workspace_invites;

create policy "workspace members can read own workspace invites"
on public.workspace_invites
for select
to authenticated
using (public.can_access_workspace(workspace_id));

create policy "workspace managers can create invites"
on public.workspace_invites
for insert
to authenticated
with check (public.can_manage_workspace(workspace_id));

create policy "workspace managers can update invites"
on public.workspace_invites
for update
to authenticated
using (public.can_manage_workspace(workspace_id))
with check (public.can_manage_workspace(workspace_id));

create policy "workspace managers can delete invites"
on public.workspace_invites
for delete
to authenticated
using (public.can_manage_workspace(workspace_id));
