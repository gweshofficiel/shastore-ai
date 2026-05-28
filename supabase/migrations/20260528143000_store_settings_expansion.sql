-- Store settings expansion.
-- Additive only: extends public.stores with owner-editable settings used by store-mode runtime.

alter table if exists public.stores
  add column if not exists store_email text,
  add column if not exists language text not null default 'en',
  add column if not exists timezone text not null default 'UTC',
  add column if not exists social_links jsonb not null default '{}'::jsonb;

update public.stores
set
  store_email = coalesce(store_email, support_email),
  language = coalesce(nullif(language, ''), 'en'),
  timezone = coalesce(nullif(timezone, ''), 'UTC'),
  social_links = case
    when jsonb_typeof(coalesce(social_links, '{}'::jsonb)) = 'object' then coalesce(social_links, '{}'::jsonb)
    else '{}'::jsonb
  end
where store_email is null
   or language is null
   or language = ''
   or timezone is null
   or timezone = ''
   or social_links is null
   or jsonb_typeof(social_links) <> 'object';
