alter table if exists public.stores
  add column if not exists whatsapp_number text;
