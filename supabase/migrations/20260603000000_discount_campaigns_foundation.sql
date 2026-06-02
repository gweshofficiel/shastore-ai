-- Discount campaigns foundation.
-- Additive only: structured campaign rules and order discount metadata.

create table if not exists public.discount_campaigns (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  discount_type text not null check (discount_type in ('percentage', 'fixed', 'free_shipping')),
  discount_value numeric(12, 2) not null default 0 check (discount_value >= 0),
  status text not null default 'draft' check (status in ('draft', 'active', 'expired')),
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (discount_type = 'free_shipping' or discount_value > 0),
  check (ends_at is null or starts_at is null or ends_at >= starts_at)
);

create table if not exists public.discount_campaign_rules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  store_id uuid not null references public.stores(id) on delete cascade,
  campaign_id uuid not null references public.discount_campaigns(id) on delete cascade,
  rule_type text not null check (rule_type in ('all_products', 'product', 'category', 'customer_segment')),
  rule_value text,
  created_at timestamptz not null default now(),
  unique (campaign_id, rule_type, rule_value)
);

alter table if exists public.store_orders
  add column if not exists discount_campaign_id uuid references public.discount_campaigns(id) on delete set null,
  add column if not exists discount_campaign_name text;

alter table if exists public.orders
  add column if not exists discount_campaign_id uuid references public.discount_campaigns(id) on delete set null,
  add column if not exists discount_campaign_name text;

create index if not exists discount_campaigns_workspace_store_idx
on public.discount_campaigns(workspace_id, store_id, status, starts_at, ends_at);

create index if not exists discount_campaign_rules_campaign_idx
on public.discount_campaign_rules(workspace_id, store_id, campaign_id, rule_type);

create index if not exists store_orders_discount_campaign_idx
on public.store_orders(discount_campaign_id)
where discount_campaign_id is not null;

create index if not exists orders_discount_campaign_idx
on public.orders(discount_campaign_id)
where discount_campaign_id is not null;

create or replace function public.set_discount_campaigns_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.name = trim(new.name);
  return new;
end;
$$;

drop trigger if exists discount_campaigns_updated_at on public.discount_campaigns;
create trigger discount_campaigns_updated_at
before insert or update on public.discount_campaigns
for each row execute function public.set_discount_campaigns_updated_at();

alter table public.discount_campaigns enable row level security;
alter table public.discount_campaign_rules enable row level security;

drop policy if exists "workspace members read discount campaigns" on public.discount_campaigns;
drop policy if exists "workspace editors write discount campaigns" on public.discount_campaigns;
drop policy if exists "workspace members read discount campaign rules" on public.discount_campaign_rules;
drop policy if exists "workspace editors write discount campaign rules" on public.discount_campaign_rules;

create policy "workspace members read discount campaigns"
on public.discount_campaigns for select to authenticated
using (public.can_access_workspace(workspace_id));

create policy "workspace editors write discount campaigns"
on public.discount_campaigns for all to authenticated
using (public.workspace_can_edit(workspace_id))
with check (public.workspace_can_edit(workspace_id));

create policy "workspace members read discount campaign rules"
on public.discount_campaign_rules for select to authenticated
using (public.can_access_workspace(workspace_id));

create policy "workspace editors write discount campaign rules"
on public.discount_campaign_rules for all to authenticated
using (public.workspace_can_edit(workspace_id))
with check (public.workspace_can_edit(workspace_id));
