-- Template package metadata runtime for Super Admin Template Management Center.
-- Additive only: metadata tracking without installing packages into stores.

create table if not exists public.template_packages (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.template_registry(id) on delete cascade,
  version_id uuid references public.template_versions(id) on delete set null,
  package_key text not null,
  package_name text not null,
  package_summary jsonb not null default '{}'::jsonb,
  contents jsonb not null default '{}'::jsonb,
  readiness_status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint template_packages_readiness_status_check
    check (readiness_status in ('draft', 'ready', 'needs_attention', 'invalid')),
  constraint template_packages_template_package_key_unique
    unique (template_id, package_key)
);

create index if not exists template_packages_template_id_idx
  on public.template_packages(template_id, readiness_status);

create index if not exists template_packages_readiness_status_idx
  on public.template_packages(readiness_status);

alter table public.template_packages enable row level security;

drop policy if exists "service role can manage template packages" on public.template_packages;
create policy "service role can manage template packages"
on public.template_packages
for all
to service_role
using (true)
with check (true);

create or replace function public.template_packages_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists template_packages_updated_at on public.template_packages;
create trigger template_packages_updated_at
before update on public.template_packages
for each row execute function public.template_packages_set_updated_at();

insert into public.template_packages (
  template_id,
  version_id,
  package_key,
  package_name,
  package_summary,
  contents,
  readiness_status
)
select
  tr.id,
  tv.id,
  tr.template_key || '-package',
  tr.name || ' Package',
  coalesce(tr.package_summary, '{}'::jsonb),
  jsonb_build_object(
    'products_count', coalesce((tr.package_summary->>'productsCount')::int, 0),
    'categories_count', coalesce((tr.package_summary->>'categoriesCount')::int, 0),
    'pages_count', coalesce((tr.package_summary->>'pagesCount')::int, 0),
    'blog_posts_count', coalesce((tr.package_summary->>'blogCount')::int, 0),
    'faq_count', coalesce((tr.package_summary->>'faqCount')::int, 0),
    'ai_support_enabled', coalesce((tr.package_summary->>'aiVisualSupport')::boolean, false),
    'domain_ready', case when tr.package_summary->>'domainEmailReadiness' = 'ready' then true else false end,
    'checkout_ready', 'unknown',
    'navigation_ready', 'unknown',
    'theme_ready', 'unknown'
  ),
  case
    when tr.status = 'archived' then 'invalid'
    when tr.status = 'active'
      and coalesce((tr.package_summary->>'pagesCount')::int, 0) > 0
      and tv.id is not null
    then 'ready'
    when coalesce((tr.package_summary->>'pagesCount')::int, 0) > 0 then 'needs_attention'
    else 'draft'
  end
from public.template_registry tr
left join lateral (
  select tv.id
  from public.template_versions tv
  where tv.template_id = tr.id
    and tv.status = 'published'
  order by tv.created_at desc
  limit 1
) tv on true
where not exists (
  select 1
  from public.template_packages tp
  where tp.template_id = tr.id
    and tp.package_key = tr.template_key || '-package'
)
on conflict (template_id, package_key) do nothing;
