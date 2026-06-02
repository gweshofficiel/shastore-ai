-- Tax management foundation.
-- Additive only: keeps checkout, orders, products, customers, billing, and existing tax data intact.

alter table if exists public.store_tax_rules
  add column if not exists tax_name text,
  add column if not exists enabled boolean not null default true;

update public.store_tax_rules
set
  tax_name = coalesce(tax_name, 'Tax'),
  enabled = case when status = 'inactive' then false else enabled end;

create index if not exists store_tax_rules_enabled_idx
on public.store_tax_rules(workspace_id, store_id, enabled, country, region, city, sort_order);
