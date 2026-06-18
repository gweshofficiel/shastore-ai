-- Generic marketplace registry for Super Admin marketplace governance only.
-- Additive metadata layer; no public purchases, installs, payouts, or payments.

create table if not exists public.marketplace_items (
  id uuid primary key default gen_random_uuid(),
  item_key text not null unique,
  slug text not null unique,
  name text not null,
  item_type text not null,
  section text not null,
  creator_source text null,
  source_type text not null default 'platform',
  status text not null default 'draft',
  visibility text not null default 'internal',
  pricing_type text not null default 'free',
  price_amount numeric null,
  currency text null,
  install_count integer not null default 0,
  revenue_amount numeric not null default 0,
  revenue_currency text null default 'USD',
  metadata jsonb not null default '{}'::jsonb,
  linked_template_id uuid null references public.template_registry(id) on delete set null,
  linked_theme_id uuid null,
  linked_plugin_id uuid null,
  linked_app_id uuid null,
  linked_service_id uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketplace_items_item_type_check
    check (item_type in ('template', 'theme', 'plugin', 'app', 'service')),
  constraint marketplace_items_section_check
    check (section in ('template_marketplace', 'theme_marketplace', 'plugin_marketplace', 'app_marketplace', 'service_marketplace')),
  constraint marketplace_items_source_type_check
    check (source_type in ('platform', 'creator', 'reseller', 'partner')),
  constraint marketplace_items_status_check
    check (status in ('draft', 'pending_review', 'approved', 'rejected', 'archived')),
  constraint marketplace_items_visibility_check
    check (visibility in ('owner', 'reseller', 'marketplace', 'internal')),
  constraint marketplace_items_pricing_type_check
    check (pricing_type in ('free', 'paid', 'premium', 'subscription'))
);

create index if not exists marketplace_items_section_status_idx
  on public.marketplace_items(section, status, updated_at desc);

create index if not exists marketplace_items_item_type_idx
  on public.marketplace_items(item_type, status);

create index if not exists marketplace_items_linked_template_idx
  on public.marketplace_items(linked_template_id)
  where linked_template_id is not null;

alter table public.marketplace_items enable row level security;

drop policy if exists "service role can manage marketplace items" on public.marketplace_items;
create policy "service role can manage marketplace items"
on public.marketplace_items
for all
to service_role
using (true)
with check (true);

create or replace function public.marketplace_items_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists marketplace_items_updated_at on public.marketplace_items;
create trigger marketplace_items_updated_at
before update on public.marketplace_items
for each row
execute function public.marketplace_items_set_updated_at();
