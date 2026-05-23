-- Store Mode custom domains foundation.
-- Additive only: no DNS/SSL automation and no changes to products, orders, themes, or publish behavior.

alter table public.published_stores
  add column if not exists custom_domain text,
  add column if not exists subdomain text,
  add column if not exists hostname text,
  add column if not exists visibility text not null default 'public',
  add column if not exists domain_status text not null default 'pending',
  add column if not exists domain_verified_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'published_stores_domain_status_check'
      and conrelid = 'public.published_stores'::regclass
  ) then
    alter table public.published_stores
      add constraint published_stores_domain_status_check
      check (domain_status in ('pending', 'verifying', 'connected', 'failed'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'published_stores_visibility_check'
      and conrelid = 'public.published_stores'::regclass
  ) then
    alter table public.published_stores
      add constraint published_stores_visibility_check
      check (visibility in ('public', 'private'));
  end if;
end $$;

create unique index if not exists published_stores_custom_domain_unique_idx
  on public.published_stores(lower(custom_domain))
  where custom_domain is not null;

create index if not exists published_stores_domain_status_idx
  on public.published_stores(domain_status, updated_at desc);

create or replace function public.resolve_storefront_hostname(candidate_hostname text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  normalized_hostname text := lower(trim(coalesce(candidate_hostname, '')));
  resolved_slug text;
begin
  if normalized_hostname = '' then
    return null;
  end if;

  select ps.slug
    into resolved_slug
  from public.published_stores ps
  where lower(ps.custom_domain) = normalized_hostname
    and ps.status = 'published'
    and ps.visibility = 'public'
    and ps.domain_status = 'connected'
  limit 1;

  return resolved_slug;
end;
$$;

grant execute on function public.resolve_storefront_hostname(text) to anon;
grant execute on function public.resolve_storefront_hostname(text) to authenticated;
