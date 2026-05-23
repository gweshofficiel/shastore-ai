alter table public.stores
add column if not exists owner_user_id uuid references auth.users(id) on delete cascade;

alter table public.stores
add column if not exists provisioning_state text not null default 'pending';

alter table public.stores
add column if not exists subscription_plan text not null default 'free';

alter table public.stores
add column if not exists is_active boolean not null default true;

create index if not exists stores_owner_user_id_idx
on public.stores(owner_user_id);

alter table public.stores enable row level security;

drop policy if exists "store owners can view own stores" on public.stores;
drop policy if exists "store owners can insert own stores" on public.stores;
drop policy if exists "store owners can update own stores" on public.stores;
drop policy if exists "store owners can delete own stores" on public.stores;

create policy "store owners can view own stores"
on public.stores
for select
to authenticated
using (auth.uid() = owner_user_id);

create policy "store owners can insert own stores"
on public.stores
for insert
to authenticated
with check (auth.uid() = owner_user_id);

create policy "store owners can update own stores"
on public.stores
for update
to authenticated
using (auth.uid() = owner_user_id)
with check (auth.uid() = owner_user_id);

create policy "store owners can delete own stores"
on public.stores
for delete
to authenticated
using (auth.uid() = owner_user_id);