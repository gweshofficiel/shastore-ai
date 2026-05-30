-- Theme selection fix for Store Mode stores (stores.id without store_instances row).
-- Additive only: keeps store_themes, does not recreate the table.

alter table public.store_themes
  alter column store_instance_id drop not null;

alter table public.store_themes
  drop constraint if exists store_themes_store_instance_id_fkey;
