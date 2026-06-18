-- MP-14: Marketplace creator accounts runtime foundation.
-- Additive creator accounts only. No payouts, bank details, or payment secrets.

create table if not exists public.marketplace_creator_accounts (
  id uuid primary key default gen_random_uuid(),
  account_id text null,
  user_id uuid null,
  display_name text not null,
  public_slug text not null unique,
  creator_type text not null default 'individual',
  creator_status text not null default 'draft',
  verification_status text not null default 'unverified',
  bio text not null default '',
  website_url text null,
  support_email text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketplace_creator_accounts_display_name_check
    check (char_length(display_name) > 0),
  constraint marketplace_creator_accounts_public_slug_check
    check (public_slug ~ '^[a-z0-9][a-z0-9-]{0,79}$'),
  constraint marketplace_creator_accounts_creator_type_check
    check (creator_type in ('individual', 'company', 'agency', 'internal')),
  constraint marketplace_creator_accounts_creator_status_check
    check (creator_status in ('draft', 'active', 'suspended', 'archived')),
  constraint marketplace_creator_accounts_verification_status_check
    check (verification_status in ('unverified', 'pending', 'verified', 'rejected'))
);

create unique index if not exists marketplace_creator_accounts_account_id_idx
  on public.marketplace_creator_accounts(account_id)
  where account_id is not null;

create unique index if not exists marketplace_creator_accounts_user_id_idx
  on public.marketplace_creator_accounts(user_id)
  where user_id is not null;

create index if not exists marketplace_creator_accounts_status_created_idx
  on public.marketplace_creator_accounts(creator_status, verification_status, created_at desc);

alter table public.marketplace_creator_accounts enable row level security;

drop policy if exists "service role can manage marketplace creator accounts" on public.marketplace_creator_accounts;
create policy "service role can manage marketplace creator accounts"
on public.marketplace_creator_accounts
for all
to service_role
using (true)
with check (true);

create or replace function public.marketplace_creator_accounts_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists marketplace_creator_accounts_updated_at on public.marketplace_creator_accounts;
create trigger marketplace_creator_accounts_updated_at
before update on public.marketplace_creator_accounts
for each row
execute function public.marketplace_creator_accounts_set_updated_at();

create or replace function public.marketplace_creator_accounts_guard_metadata()
returns trigger
language plpgsql
as $$
declare
  metadata_text text;
begin
  if new.creator_status not in ('draft', 'active', 'suspended', 'archived') then
    raise exception 'Invalid marketplace creator_status: %', new.creator_status;
  end if;

  if new.verification_status not in ('unverified', 'pending', 'verified', 'rejected') then
    raise exception 'Invalid marketplace verification_status: %', new.verification_status;
  end if;

  if new.creator_type not in ('individual', 'company', 'agency', 'internal') then
    raise exception 'Invalid marketplace creator_type: %', new.creator_type;
  end if;

  metadata_text := lower(new.metadata::text);

  if metadata_text like '%api_key%' or metadata_text like '%apikey%' then
    raise exception 'Marketplace creator metadata must not contain API secrets';
  end if;

  if metadata_text like '%password%' or metadata_text like '%secret%' or metadata_text like '%token%' then
    raise exception 'Marketplace creator metadata must not contain secrets';
  end if;

  if metadata_text like '%bank_%' or metadata_text like '%iban%' or metadata_text like '%payout%' then
    raise exception 'Marketplace creator metadata must not contain payout credentials';
  end if;

  return new;
end;
$$;

drop trigger if exists marketplace_creator_accounts_guard_metadata on public.marketplace_creator_accounts;
create trigger marketplace_creator_accounts_guard_metadata
before insert or update of metadata, creator_status, verification_status, creator_type
on public.marketplace_creator_accounts
for each row
execute function public.marketplace_creator_accounts_guard_metadata();

insert into public.marketplace_creator_accounts (
  display_name,
  public_slug,
  creator_type,
  creator_status,
  verification_status,
  bio,
  metadata
)
select
  'SHASTORE Platform',
  'shastore-platform',
  'internal',
  'active',
  'verified',
  'Official SHASTORE platform marketplace creator account.',
  jsonb_build_object(
    'foundation_only', true,
    'payout_runtime', false,
    'source', 'marketplace_creator_runtime_seed'
  )
where not exists (
  select 1
  from public.marketplace_creator_accounts mca
  where mca.public_slug = 'shastore-platform'
);

insert into public.marketplace_creator_accounts (
  display_name,
  public_slug,
  creator_type,
  creator_status,
  verification_status,
  bio,
  metadata
)
select
  'SHASTORE Services',
  'shastore-services',
  'internal',
  'active',
  'verified',
  'Official SHASTORE services marketplace creator account.',
  jsonb_build_object(
    'foundation_only', true,
    'payout_runtime', false,
    'source', 'marketplace_creator_runtime_seed'
  )
where not exists (
  select 1
  from public.marketplace_creator_accounts mca
  where mca.public_slug = 'shastore-services'
);

alter table public.marketplace_items
  add column if not exists creator_account_id uuid null;

update public.marketplace_items mi
set creator_account_id = mca.id
from public.marketplace_creator_accounts mca
where mi.creator_account_id is null
  and mca.public_slug = 'shastore-services'
  and lower(coalesce(mi.creator_source, '')) like '%services%';

update public.marketplace_items mi
set creator_account_id = mca.id
from public.marketplace_creator_accounts mca
where mi.creator_account_id is null
  and mca.public_slug = 'shastore-platform';

alter table public.marketplace_items
  drop constraint if exists marketplace_items_creator_account_id_fkey;

alter table public.marketplace_items
  add constraint marketplace_items_creator_account_id_fkey
  foreign key (creator_account_id) references public.marketplace_creator_accounts(id) on delete restrict;

create index if not exists marketplace_items_creator_account_idx
  on public.marketplace_items(creator_account_id)
  where creator_account_id is not null;
