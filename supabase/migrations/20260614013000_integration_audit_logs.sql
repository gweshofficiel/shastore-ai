-- Integration audit logs.
-- Additive only: Super Admin audit trail for provider-related operations.
-- No provider mutation, customer-facing access, or secret storage.

create extension if not exists "pgcrypto";

create table if not exists public.integration_audit_logs (
  id uuid primary key default gen_random_uuid(),
  provider_key text not null,
  provider_name text not null,
  category text not null,
  operation text not null,
  status text not null,
  store_id uuid null,
  user_id uuid null references auth.users(id) on delete set null,
  workspace_id uuid null,
  related_entity_type text null,
  related_entity_id text null,
  request_id text null,
  error_code text null,
  error_message text null,
  safe_summary jsonb null,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'integration_audit_logs_status_check'
      and conrelid = 'public.integration_audit_logs'::regclass
  ) then
    alter table public.integration_audit_logs
      add constraint integration_audit_logs_status_check
      check (status in ('started', 'success', 'failed', 'skipped', 'blocked'));
  end if;
end $$;

create index if not exists integration_audit_logs_provider_created_idx
on public.integration_audit_logs(provider_key, created_at desc);

create index if not exists integration_audit_logs_category_created_idx
on public.integration_audit_logs(category, created_at desc);

create index if not exists integration_audit_logs_status_created_idx
on public.integration_audit_logs(status, created_at desc);

create index if not exists integration_audit_logs_created_idx
on public.integration_audit_logs(created_at desc);

alter table public.integration_audit_logs enable row level security;

drop policy if exists "service role can manage integration audit logs" on public.integration_audit_logs;
create policy "service role can manage integration audit logs"
on public.integration_audit_logs
for all
to service_role
using (true)
with check (true);
