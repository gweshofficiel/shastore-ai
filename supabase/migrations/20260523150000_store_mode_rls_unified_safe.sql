-- Unify stores RLS for Store Mode drafts (user_id + owner_user_id).
-- Safe to re-run: backfills owner linkage and replaces conflicting policies.

update public.stores
set owner_user_id = user_id
where owner_user_id is null
  and user_id is not null;

drop policy if exists "Users manage own stores" on public.stores;
drop policy if exists "store owners can view own stores" on public.stores;
drop policy if exists "store owners can insert own stores" on public.stores;
drop policy if exists "store owners can update own stores" on public.stores;
drop policy if exists "store owners can delete own stores" on public.stores;

create policy "store owners can view own stores"
on public.stores
for select
to authenticated
using (auth.uid() = owner_user_id or auth.uid() = user_id);

create policy "store owners can insert own stores"
on public.stores
for insert
to authenticated
with check (auth.uid() = owner_user_id or auth.uid() = user_id);

create policy "store owners can update own stores"
on public.stores
for update
to authenticated
using (auth.uid() = owner_user_id or auth.uid() = user_id)
with check (auth.uid() = owner_user_id or auth.uid() = user_id);

create policy "store owners can delete own stores"
on public.stores
for delete
to authenticated
using (auth.uid() = owner_user_id or auth.uid() = user_id);
