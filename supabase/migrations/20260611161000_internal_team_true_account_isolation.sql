-- Phase 1.2.E: Internal Team invite true account isolation
-- Additive-safe migration. Preserves existing rows, RLS policies, and legacy role keys.

alter table if exists public.internal_team_members
  add column if not exists email_change_requested boolean not null default false,
  add column if not exists requested_new_email text null;

alter table if exists public.internal_team_invitations
  add column if not exists accepted_by_user_id uuid null references auth.users(id) on delete set null;

alter table if exists public.internal_team_members
  drop constraint if exists internal_team_members_role_check;

alter table if exists public.internal_team_invitations
  drop constraint if exists internal_team_invitations_role_check;

alter table if exists public.internal_team_members
  add constraint internal_team_members_role_check
  check (role in (
    'super_admin',
    'admin',
    'support_agent',
    'moderator',
    'content_moderator',
    'finance_manager',
    'finance_operator',
    'marketing_operator',
    'security_analyst',
    'developer_operator',
    'read_only_auditor'
  ));

alter table if exists public.internal_team_invitations
  add constraint internal_team_invitations_role_check
  check (role in (
    'super_admin',
    'admin',
    'support_agent',
    'moderator',
    'content_moderator',
    'finance_manager',
    'finance_operator',
    'marketing_operator',
    'security_analyst',
    'developer_operator',
    'read_only_auditor'
  ));
