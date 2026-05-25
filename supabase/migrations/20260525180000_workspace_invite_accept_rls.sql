-- Allow invited users to join a workspace when accepting a valid pending invitation.
-- Service-role acceptance remains primary; these policies are a safe fallback.

drop policy if exists "invited users can join via pending invitation" on public.workspace_members;
drop policy if exists "invited users can accept own invitation" on public.workspace_invitations;

create policy "invited users can join via pending invitation"
on public.workspace_members
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.workspace_invitations inv
    where inv.workspace_id = workspace_members.workspace_id
      and lower(inv.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and inv.status = 'pending'
      and inv.expires_at > now()
  )
);

create policy "invited users can accept own invitation"
on public.workspace_invitations
for update
to authenticated
using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')))
with check (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));
