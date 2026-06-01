-- Storefront customer address book foundation.
-- Additive only: reuses store_customers/customer_addresses without changing checkout or seller customer CRUD.

alter table if exists public.customer_addresses
  add column if not exists notes text;

create index if not exists customer_addresses_default_idx
on public.customer_addresses(workspace_id, store_id, customer_id, is_default, updated_at desc);
