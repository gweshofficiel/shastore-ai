create table if not exists public.store_audit_logs (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists store_audit_logs_store_id_created_at_idx
on public.store_audit_logs(store_id, created_at desc);

create index if not exists store_audit_logs_actor_user_id_created_at_idx
on public.store_audit_logs(actor_user_id, created_at desc);

alter table public.store_audit_logs enable row level security;

drop policy if exists "store audit owners can read own store logs" on public.store_audit_logs;
drop policy if exists "service role can insert store audit logs" on public.store_audit_logs;

do $$
begin
  if to_regclass('public.store_instances') is not null then
    execute $policy$
      create policy "store audit owners can read own store logs"
      on public.store_audit_logs
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.stores s
          where s.id = store_audit_logs.store_id
            and (auth.uid() = s.owner_user_id or auth.uid() = s.user_id)
        )
        or exists (
          select 1
          from public.store_instances si
          where si.id = store_audit_logs.store_id
            and auth.uid() = si.owner_user_id
        )
      )
    $policy$;
  else
    create policy "store audit owners can read own store logs"
    on public.store_audit_logs
    for select
    to authenticated
    using (
      exists (
        select 1
        from public.stores s
        where s.id = store_audit_logs.store_id
          and (auth.uid() = s.owner_user_id or auth.uid() = s.user_id)
      )
    );
  end if;
end $$;

create policy "service role can insert store audit logs"
on public.store_audit_logs
for insert
to service_role
with check (true);

grant select on public.store_audit_logs to authenticated;
grant insert on public.store_audit_logs to service_role;
