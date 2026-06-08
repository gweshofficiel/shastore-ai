-- Proof of delivery foundation.
-- Additive only: stores private delivery proof records and optional delivery code placeholders.

alter table public.delivery_assignments
  add column if not exists delivery_code_placeholder text;

create table if not exists public.delivery_proofs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  store_id uuid not null references public.stores(id) on delete cascade,
  assignment_id uuid not null references public.delivery_assignments(id) on delete cascade,
  order_id uuid not null,
  order_source text not null check (order_source in ('orders', 'store_orders')),
  delivery_agent_id uuid not null references public.store_delivery_agents(id) on delete cascade,
  proof_type text not null default 'delivery_confirmation' check (proof_type in ('delivery_confirmation')),
  delivery_code text,
  delivery_code_verified boolean not null default false,
  customer_name text,
  signature_text_placeholder text,
  photo_url_placeholder text,
  notes text,
  delivered_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists delivery_proofs_assignment_unique_idx
on public.delivery_proofs(assignment_id);

create index if not exists delivery_proofs_order_idx
on public.delivery_proofs(workspace_id, store_id, order_source, order_id);

create index if not exists delivery_proofs_agent_idx
on public.delivery_proofs(delivery_agent_id, delivered_at desc);

alter table public.delivery_proofs enable row level security;

drop policy if exists "workspace members read delivery proofs" on public.delivery_proofs;
drop policy if exists "workspace editors write delivery proofs" on public.delivery_proofs;
drop policy if exists "delivery agents read own proofs" on public.delivery_proofs;
drop policy if exists "delivery agents insert own proofs" on public.delivery_proofs;

create policy "workspace members read delivery proofs"
on public.delivery_proofs for select to authenticated
using (public.can_access_workspace(workspace_id));

create policy "workspace editors write delivery proofs"
on public.delivery_proofs for all to authenticated
using (public.workspace_can_edit(workspace_id))
with check (public.workspace_can_edit(workspace_id));

create policy "delivery agents read own proofs"
on public.delivery_proofs for select to authenticated
using (
  exists (
    select 1
    from public.store_delivery_agents agents
    where agents.id = delivery_proofs.delivery_agent_id
      and agents.store_id = delivery_proofs.store_id
      and agents.status = 'active'
      and agents.metadata->>'auth_user_id' = auth.uid()::text
  )
);

create policy "delivery agents insert own proofs"
on public.delivery_proofs for insert to authenticated
with check (
  exists (
    select 1
    from public.store_delivery_agents agents
    where agents.id = delivery_proofs.delivery_agent_id
      and agents.store_id = delivery_proofs.store_id
      and agents.status = 'active'
      and agents.metadata->>'auth_user_id' = auth.uid()::text
  )
);
