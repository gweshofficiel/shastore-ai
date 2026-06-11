-- Phase 1.2: Internal Team Runtime
-- Additive only. Internal staff governance is separate from Store Owner workspace teams
-- and from customer/owner/reseller/delivery account_roles.

create table if not exists public.internal_team_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references auth.users(id) on delete set null,
  email text not null,
  display_name text null,
  role text not null default 'read_only_auditor'
    check (role in (
      'super_admin',
      'admin',
      'support_agent',
      'moderator',
      'finance_manager',
      'security_analyst',
      'developer_operator',
      'read_only_auditor'
    )),
  status text not null default 'active'
    check (status in ('active', 'suspended')),
  invited_by uuid null references auth.users(id) on delete set null,
  invited_at timestamptz null,
  accepted_at timestamptz null,
  last_active_at timestamptz null,
  suspended_at timestamptz null,
  restored_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists internal_team_members_email_unique_idx
on public.internal_team_members (lower(email));

create unique index if not exists internal_team_members_user_unique_idx
on public.internal_team_members (user_id)
where user_id is not null;

create index if not exists internal_team_members_role_status_idx
on public.internal_team_members (role, status, updated_at desc);

create table if not exists public.internal_team_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  display_name text null,
  role text not null default 'read_only_auditor'
    check (role in (
      'super_admin',
      'admin',
      'support_agent',
      'moderator',
      'finance_manager',
      'security_analyst',
      'developer_operator',
      'read_only_auditor'
    )),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'expired', 'cancelled')),
  token_hash text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz null,
  accepted_user_id uuid null references auth.users(id) on delete set null,
  invited_by uuid null references auth.users(id) on delete set null,
  cancelled_at timestamptz null,
  cancelled_by uuid null references auth.users(id) on delete set null,
  last_sent_at timestamptz null,
  email_status text not null default 'not_sent'
    check (email_status in ('not_sent', 'attempted', 'sent', 'failed', 'skipped')),
  email_error text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists internal_team_invitations_email_status_idx
on public.internal_team_invitations (lower(email), status, expires_at desc);

create index if not exists internal_team_invitations_status_created_idx
on public.internal_team_invitations (status, created_at desc);

create or replace function public.set_internal_team_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists internal_team_members_updated_at on public.internal_team_members;
create trigger internal_team_members_updated_at
before update on public.internal_team_members
for each row execute function public.set_internal_team_updated_at();

drop trigger if exists internal_team_invitations_updated_at on public.internal_team_invitations;
create trigger internal_team_invitations_updated_at
before update on public.internal_team_invitations
for each row execute function public.set_internal_team_updated_at();

alter table public.internal_team_members enable row level security;
alter table public.internal_team_invitations enable row level security;

drop policy if exists "internal team members read own row" on public.internal_team_members;
drop policy if exists "active internal team members read team" on public.internal_team_members;
drop policy if exists "service role manages internal team members" on public.internal_team_members;

create policy "internal team members read own row"
on public.internal_team_members
for select
to authenticated
using (auth.uid() = user_id);

create policy "active internal team members read team"
on public.internal_team_members
for select
to authenticated
using (
  exists (
    select 1
    from public.internal_team_members current_member
    where current_member.user_id = auth.uid()
      and current_member.status = 'active'
  )
);

create policy "service role manages internal team members"
on public.internal_team_members
for all
to service_role
using (true)
with check (true);

drop policy if exists "internal invitees read own pending invitations" on public.internal_team_invitations;
drop policy if exists "active internal team members read invitations" on public.internal_team_invitations;
drop policy if exists "service role manages internal team invitations" on public.internal_team_invitations;

create policy "internal invitees read own pending invitations"
on public.internal_team_invitations
for select
to authenticated
using (
  status = 'pending'
  and expires_at > now()
  and lower(email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
);

create policy "active internal team members read invitations"
on public.internal_team_invitations
for select
to authenticated
using (
  exists (
    select 1
    from public.internal_team_members current_member
    where current_member.user_id = auth.uid()
      and current_member.status = 'active'
  )
);

create policy "service role manages internal team invitations"
on public.internal_team_invitations
for all
to service_role
using (true)
with check (true);

grant select on public.internal_team_members to authenticated;
grant select on public.internal_team_invitations to authenticated;
grant all on public.internal_team_members to service_role;
grant all on public.internal_team_invitations to service_role;
