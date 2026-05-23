-- Store Mode draft payload column (schema only, no RLS changes).
alter table public.stores
add column if not exists store_data jsonb not null default '{}'::jsonb;

alter table public.stores
add column if not exists slug text;
