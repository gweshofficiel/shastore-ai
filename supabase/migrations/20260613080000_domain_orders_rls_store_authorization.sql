-- Repair domain_orders RLS for stores.id authorization.
-- Additive only: domain_orders.store_id references public.stores(id), not store_instances.

drop policy if exists "store members read domain orders" on public.domain_orders;
create policy "store members read domain orders"
on public.domain_orders
for select
to authenticated
using (
  public.can_access_store_instance(store_id)
  or exists (
    select 1
    from public.stores s
    where s.id = domain_orders.store_id
      and (
        public.can_access_workspace(s.workspace_id)
        or auth.uid() = s.owner_user_id
        or auth.uid() = s.user_id
      )
  )
);

drop policy if exists "store managers write domain orders" on public.domain_orders;
drop policy if exists "store managers insert domain orders" on public.domain_orders;
create policy "store managers insert domain orders"
on public.domain_orders
for insert
to authenticated
with check (
  public.can_manage_store_instance(store_id)
  or exists (
    select 1
    from public.stores s
    where s.id = domain_orders.store_id
      and (
        public.workspace_can_edit(s.workspace_id)
        or auth.uid() = s.owner_user_id
      )
  )
);

drop policy if exists "store managers update domain orders" on public.domain_orders;
create policy "store managers update domain orders"
on public.domain_orders
for update
to authenticated
using (
  public.can_manage_store_instance(store_id)
  or exists (
    select 1
    from public.stores s
    where s.id = domain_orders.store_id
      and (
        public.workspace_can_edit(s.workspace_id)
        or auth.uid() = s.owner_user_id
      )
  )
)
with check (
  public.can_manage_store_instance(store_id)
  or exists (
    select 1
    from public.stores s
    where s.id = domain_orders.store_id
      and (
        public.workspace_can_edit(s.workspace_id)
        or auth.uid() = s.owner_user_id
      )
  )
);
