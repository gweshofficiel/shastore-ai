-- Integration secret rotation metadata.
-- Additive only: tracks rotation state for named secret keys without storing secret values.
-- No environment mutation, provider mutation, customer-facing access, or secret storage.

create extension if not exists "pgcrypto";

create table if not exists public.integration_secret_rotation_records (
  id uuid primary key default gen_random_uuid(),
  provider_key text not null,
  secret_key_name text not null,
  secret_category text not null,
  status text not null default 'unknown',
  rotation_required boolean not null default false,
  last_rotated_at timestamptz null,
  last_rotated_by uuid null references auth.users(id) on delete set null,
  next_rotation_due_at timestamptz null,
  rotation_note text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider_key, secret_key_name)
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'integration_secret_rotation_records_status_check'
      and conrelid = 'public.integration_secret_rotation_records'::regclass
  ) then
    alter table public.integration_secret_rotation_records
      add constraint integration_secret_rotation_records_status_check
      check (status in ('active', 'rotation_due', 'rotated', 'disabled', 'unknown'));
  end if;
end $$;

create index if not exists integration_secret_rotation_records_provider_idx
on public.integration_secret_rotation_records(provider_key, secret_key_name);

create index if not exists integration_secret_rotation_records_required_idx
on public.integration_secret_rotation_records(rotation_required, next_rotation_due_at);

create or replace function public.set_integration_secret_rotation_records_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_integration_secret_rotation_records_updated_at on public.integration_secret_rotation_records;
create trigger set_integration_secret_rotation_records_updated_at
before update on public.integration_secret_rotation_records
for each row
execute function public.set_integration_secret_rotation_records_updated_at();

alter table public.integration_secret_rotation_records enable row level security;

drop policy if exists "service role can manage integration secret rotation records" on public.integration_secret_rotation_records;
create policy "service role can manage integration secret rotation records"
on public.integration_secret_rotation_records
for all
to service_role
using (true)
with check (true);
