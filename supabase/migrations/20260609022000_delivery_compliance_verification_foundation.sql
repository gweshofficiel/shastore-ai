-- Delivery compliance and verification foundation.
-- Additive only: delivery-scoped verification status, eligibility, checklist flags, and violation records.

create table if not exists public.delivery_agent_compliance (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  store_id uuid not null references public.stores(id) on delete cascade,
  delivery_agent_id uuid not null references public.store_delivery_agents(id) on delete cascade,
  verification_status text not null default 'not_started' check (
    verification_status in ('not_started', 'pending_review', 'verified', 'rejected', 'expired')
  ),
  eligibility_status text not null default 'pending_review' check (
    eligibility_status in ('eligible', 'not_eligible', 'pending_review', 'suspended', 'blocked')
  ),
  identity_status text not null default 'not_started' check (
    identity_status in ('not_started', 'pending_review', 'verified', 'rejected', 'expired')
  ),
  phone_status text not null default 'not_started' check (
    phone_status in ('not_started', 'pending_review', 'verified', 'rejected', 'expired')
  ),
  vehicle_status text not null default 'not_started' check (
    vehicle_status in ('not_started', 'pending_review', 'verified', 'rejected', 'expired')
  ),
  license_status text not null default 'not_started' check (
    license_status in ('not_started', 'pending_review', 'verified', 'rejected', 'expired')
  ),
  store_approval_status text not null default 'pending_review' check (
    store_approval_status in ('not_started', 'pending_review', 'verified', 'rejected', 'expired')
  ),
  profile_completed boolean not null default false,
  phone_verified boolean not null default false,
  vehicle_information_completed boolean not null default false,
  license_uploaded_placeholder boolean not null default false,
  assigned_region_confirmed boolean not null default false,
  owner_approved boolean not null default false,
  no_active_violations boolean not null default true,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (delivery_agent_id)
);

create table if not exists public.delivery_violations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  store_id uuid not null references public.stores(id) on delete cascade,
  delivery_agent_id uuid not null references public.store_delivery_agents(id) on delete cascade,
  violation_type text not null check (
    violation_type in (
      'late_delivery',
      'failed_proof',
      'cod_dispute',
      'customer_complaint',
      'owner_complaint',
      'policy_issue'
    )
  ),
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
  title text not null,
  notes text,
  order_source text check (order_source is null or order_source in ('orders', 'store_orders')),
  order_id uuid,
  reported_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists delivery_agent_compliance_store_idx
on public.delivery_agent_compliance(workspace_id, store_id, eligibility_status, verification_status);

create index if not exists delivery_agent_compliance_agent_idx
on public.delivery_agent_compliance(delivery_agent_id);

create index if not exists delivery_violations_agent_status_idx
on public.delivery_violations(workspace_id, store_id, delivery_agent_id, status, created_at desc);

create index if not exists delivery_violations_order_idx
on public.delivery_violations(workspace_id, store_id, order_source, order_id, created_at desc)
where order_id is not null;

create or replace function public.set_delivery_agent_compliance_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists delivery_agent_compliance_updated_at on public.delivery_agent_compliance;
create trigger delivery_agent_compliance_updated_at
before insert or update on public.delivery_agent_compliance
for each row execute function public.set_delivery_agent_compliance_updated_at();

create or replace function public.set_delivery_violations_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.title = nullif(trim(coalesce(new.title, '')), '');

  if new.title is null then
    raise exception 'delivery violation title is required';
  end if;

  return new;
end;
$$;

drop trigger if exists delivery_violations_updated_at on public.delivery_violations;
create trigger delivery_violations_updated_at
before insert or update on public.delivery_violations
for each row execute function public.set_delivery_violations_updated_at();

insert into public.delivery_agent_compliance (
  workspace_id,
  store_id,
  delivery_agent_id,
  verification_status,
  eligibility_status,
  identity_status,
  phone_status,
  store_approval_status,
  profile_completed,
  phone_verified,
  assigned_region_confirmed,
  owner_approved,
  no_active_violations,
  metadata
)
select
  agents.workspace_id,
  agents.store_id,
  agents.id,
  case when agents.status = 'active' then 'pending_review' else 'rejected' end,
  case when agents.status = 'active' then 'pending_review' else 'suspended' end,
  'pending_review',
  case when agents.normalized_phone is not null then 'verified' else 'not_started' end,
  case when agents.status = 'active' then 'verified' else 'rejected' end,
  (agents.name is not null and agents.normalized_phone is not null),
  (agents.normalized_phone is not null),
  (agents.city_zone is not null),
  (agents.status = 'active'),
  true,
  jsonb_build_object('source', 'delivery_compliance_backfill')
from public.store_delivery_agents agents
where not exists (
  select 1
  from public.delivery_agent_compliance compliance
  where compliance.delivery_agent_id = agents.id
);

alter table public.delivery_agent_compliance enable row level security;
alter table public.delivery_violations enable row level security;

drop policy if exists "workspace members read delivery compliance" on public.delivery_agent_compliance;
drop policy if exists "workspace editors write delivery compliance" on public.delivery_agent_compliance;
drop policy if exists "delivery agents read own compliance" on public.delivery_agent_compliance;
drop policy if exists "workspace members read delivery violations" on public.delivery_violations;
drop policy if exists "workspace editors write delivery violations" on public.delivery_violations;
drop policy if exists "delivery agents read own violations" on public.delivery_violations;

create policy "workspace members read delivery compliance"
on public.delivery_agent_compliance for select to authenticated
using (public.can_access_workspace(workspace_id));

create policy "workspace editors write delivery compliance"
on public.delivery_agent_compliance for all to authenticated
using (public.workspace_can_edit(workspace_id))
with check (public.workspace_can_edit(workspace_id));

create policy "delivery agents read own compliance"
on public.delivery_agent_compliance for select to authenticated
using (
  exists (
    select 1
    from public.store_delivery_agents agents
    where agents.id = delivery_agent_compliance.delivery_agent_id
      and agents.store_id = delivery_agent_compliance.store_id
      and agents.metadata->>'auth_user_id' = auth.uid()::text
  )
);

create policy "workspace members read delivery violations"
on public.delivery_violations for select to authenticated
using (public.can_access_workspace(workspace_id));

create policy "workspace editors write delivery violations"
on public.delivery_violations for all to authenticated
using (public.workspace_can_edit(workspace_id))
with check (public.workspace_can_edit(workspace_id));

create policy "delivery agents read own violations"
on public.delivery_violations for select to authenticated
using (
  exists (
    select 1
    from public.store_delivery_agents agents
    where agents.id = delivery_violations.delivery_agent_id
      and agents.store_id = delivery_violations.store_id
      and agents.metadata->>'auth_user_id' = auth.uid()::text
  )
);
