-- Align legacy store_media.file_path with storage_key for Media Library uploads.

alter table public.store_media
  add column if not exists file_path text,
  add column if not exists storage_key text;

update public.store_media
set file_path = storage_key
where (file_path is null or file_path = '')
  and storage_key is not null
  and storage_key <> '';

update public.store_media
set storage_key = file_path
where (storage_key is null or storage_key = '')
  and file_path is not null
  and file_path <> '';
