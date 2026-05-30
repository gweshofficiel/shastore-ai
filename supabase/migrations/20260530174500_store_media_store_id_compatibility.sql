-- Store media compatibility for Store Mode records.
-- Existing production store_media may have legacy store_instance_id constraints.

alter table public.store_media
  alter column store_instance_id drop not null;
