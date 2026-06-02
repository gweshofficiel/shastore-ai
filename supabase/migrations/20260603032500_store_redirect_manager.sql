-- Store redirect manager foundation.
-- Additive only: preserves existing SEO, sitemap, robots, domains, and storefront routes.

create table if not exists public.store_redirects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  store_id uuid not null references public.stores(id) on delete cascade,
  source_path text not null,
  destination_url text not null,
  redirect_type integer not null default 301 check (redirect_type in (301, 302)),
  status text not null default 'active' check (status in ('active', 'disabled')),
  hits_count bigint not null default 0,
  last_hit_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint store_redirects_source_path_format check (source_path ~ '^/[^?#]*$')
);

create unique index if not exists store_redirects_store_source_unique_idx
on public.store_redirects(store_id, lower(source_path));

create index if not exists store_redirects_workspace_store_status_idx
on public.store_redirects(workspace_id, store_id, status, updated_at desc);

create or replace function public.set_store_redirects_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.source_path = lower(trim(new.source_path));
  new.destination_url = trim(new.destination_url);
  return new;
end;
$$;

drop trigger if exists store_redirects_updated_at on public.store_redirects;
create trigger store_redirects_updated_at
before insert or update on public.store_redirects
for each row execute function public.set_store_redirects_updated_at();

create or replace function public.record_store_redirect_hit(p_redirect_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.store_redirects
  set
    hits_count = hits_count + 1,
    last_hit_at = now()
  where id = p_redirect_id
    and status = 'active';
end;
$$;

alter table public.store_redirects enable row level security;

drop policy if exists "workspace members read store redirects" on public.store_redirects;
drop policy if exists "workspace editors manage store redirects" on public.store_redirects;
drop policy if exists "public reads active store redirects" on public.store_redirects;

create policy "workspace members read store redirects"
on public.store_redirects for select to authenticated
using (public.can_access_workspace(workspace_id));

create policy "workspace editors manage store redirects"
on public.store_redirects for all to authenticated
using (public.workspace_can_edit(workspace_id))
with check (public.workspace_can_edit(workspace_id));

create policy "public reads active store redirects"
on public.store_redirects for select to anon, authenticated
using (
  status = 'active'
  and exists (
    select 1
    from public.stores stores
    left join public.published_stores published
      on published.store_id = stores.id
    where stores.id = store_redirects.store_id
      and stores.status = 'published'
      and coalesce(published.status, 'published') = 'published'
      and coalesce(published.visibility, 'public') = 'public'
  )
);

grant execute on function public.record_store_redirect_hit(uuid) to anon, authenticated;
