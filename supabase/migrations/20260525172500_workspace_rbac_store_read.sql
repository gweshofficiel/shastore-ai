-- Allow workspace members to read stores in their workspace.
-- Writes remain constrained by existing owner/admin policies and server-side RBAC.

drop policy if exists "store owners can view own stores" on public.stores;

create policy "store owners and workspace members can view stores"
on public.stores
for select
to authenticated
using (
  auth.uid() = owner_user_id
  or public.can_access_workspace(workspace_id)
  or public.shastore_is_admin()
);
