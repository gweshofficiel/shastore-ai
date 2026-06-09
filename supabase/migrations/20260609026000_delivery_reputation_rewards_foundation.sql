-- Delivery reputation and rewards foundation.
-- Additive only: reputation snapshots and reward placeholders. No payout, wallet, withdrawal, or financial ledger.

create table if not exists public.delivery_agent_reputation (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  store_id uuid not null references public.stores(id) on delete cascade,
  delivery_agent_id uuid not null references public.store_delivery_agents(id) on delete cascade,
  reputation_score numeric(5,2) not null default 0 check (reputation_score >= 0 and reputation_score <= 100),
  score_level text not null default 'low' check (score_level in ('low', 'medium', 'good', 'excellent')),
  delivery_level text not null default 'bronze' check (delivery_level in ('bronze', 'silver', 'gold', 'platinum', 'elite')),
  badges text[] not null default '{}'::text[],
  success_rate numeric(5,2) not null default 0,
  average_rating numeric(3,2) not null default 0,
  completed_deliveries integer not null default 0,
  return_rate numeric(5,2) not null default 0,
  incident_count integer not null default 0,
  cod_reliability numeric(5,2) not null default 0,
  on_time_rate_placeholder numeric(5,2) not null default 0,
  reward_points_placeholder integer not null default 0,
  monthly_bonus_placeholder numeric(10,2) not null default 0,
  recognition_badge_placeholder text,
  metadata jsonb not null default '{}'::jsonb,
  recalculated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (delivery_agent_id)
);

create index if not exists delivery_agent_reputation_store_idx
on public.delivery_agent_reputation(workspace_id, store_id, reputation_score desc, delivery_level);

create index if not exists delivery_agent_reputation_agent_idx
on public.delivery_agent_reputation(delivery_agent_id);

create or replace function public.set_delivery_agent_reputation_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists delivery_agent_reputation_updated_at on public.delivery_agent_reputation;
create trigger delivery_agent_reputation_updated_at
before insert or update on public.delivery_agent_reputation
for each row execute function public.set_delivery_agent_reputation_updated_at();

alter table public.delivery_agent_reputation enable row level security;

drop policy if exists "workspace members read delivery reputation" on public.delivery_agent_reputation;
drop policy if exists "workspace editors write delivery reputation" on public.delivery_agent_reputation;
drop policy if exists "delivery agents read own reputation" on public.delivery_agent_reputation;

create policy "workspace members read delivery reputation"
on public.delivery_agent_reputation for select to authenticated
using (public.can_access_workspace(workspace_id));

create policy "workspace editors write delivery reputation"
on public.delivery_agent_reputation for all to authenticated
using (public.workspace_can_edit(workspace_id))
with check (public.workspace_can_edit(workspace_id));

create policy "delivery agents read own reputation"
on public.delivery_agent_reputation for select to authenticated
using (
  exists (
    select 1
    from public.store_delivery_agents agents
    where agents.id = delivery_agent_reputation.delivery_agent_id
      and agents.store_id = delivery_agent_reputation.store_id
      and agents.metadata->>'auth_user_id' = auth.uid()::text
  )
);
