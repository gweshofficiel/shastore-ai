-- Customers workspace RLS repair.
-- Additive only: removes legacy store_instances-scoped policies that block dashboard reads.

do $$
begin
  if to_regclass('public.customers') is null then
    return;
  end if;

  alter table public.customers enable row level security;

  drop policy if exists "Buyer store members read customers" on public.customers;
  drop policy if exists "Buyer store managers write customers" on public.customers;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'customers'
      and policyname = 'workspace members read customers'
  ) then
    create policy "workspace members read customers"
    on public.customers
    for select
    to authenticated
    using (public.can_access_workspace(workspace_id));
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'customers'
      and policyname = 'workspace managers write customers'
  ) then
    create policy "workspace managers write customers"
    on public.customers
    for all
    to authenticated
    using (public.workspace_can_edit(workspace_id))
    with check (public.workspace_can_edit(workspace_id));
  end if;
end $$;
