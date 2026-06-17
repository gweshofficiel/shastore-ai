-- Template marketplace listings for Super Admin catalog governance only.
-- Additive metadata/runtime tracking; no public purchase, install, or payment flows.

create table if not exists public.template_marketplace_listings (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.template_registry(id) on delete cascade,
  template_version_id uuid references public.template_versions(id) on delete set null,
  listing_status text not null default 'draft',
  listing_title text not null,
  listing_description text null,
  pricing_type text not null default 'free',
  price_amount numeric null,
  currency text null,
  visibility text not null default 'marketplace',
  featured boolean not null default false,
  approval_status text not null default 'pending_review',
  metadata jsonb not null default '{}'::jsonb,
  published_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint template_marketplace_listings_status_check
    check (listing_status in ('draft', 'published', 'archived')),
  constraint template_marketplace_listings_pricing_type_check
    check (pricing_type in ('free', 'paid', 'included')),
  constraint template_marketplace_listings_approval_status_check
    check (approval_status in ('pending_review', 'approved', 'rejected'))
);

create index if not exists template_marketplace_listings_template_status_idx
  on public.template_marketplace_listings(template_id, listing_status, created_at desc);

create index if not exists template_marketplace_listings_status_featured_idx
  on public.template_marketplace_listings(listing_status, featured, published_at desc);

create index if not exists template_marketplace_listings_approval_status_idx
  on public.template_marketplace_listings(approval_status, listing_status);

alter table public.template_marketplace_listings enable row level security;

drop policy if exists "service role can manage template marketplace listings" on public.template_marketplace_listings;
create policy "service role can manage template marketplace listings"
on public.template_marketplace_listings
for all
to service_role
using (true)
with check (true);

create or replace function public.template_marketplace_listings_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists template_marketplace_listings_updated_at on public.template_marketplace_listings;
create trigger template_marketplace_listings_updated_at
before update on public.template_marketplace_listings
for each row execute function public.template_marketplace_listings_set_updated_at();
