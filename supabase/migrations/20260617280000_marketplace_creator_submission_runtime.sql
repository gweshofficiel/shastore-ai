-- MP-15: Marketplace creator submission runtime foundation.
-- Additive submission metadata only. No approval decisions, payouts, or public catalog.

create table if not exists public.marketplace_creator_submissions (
  id uuid primary key default gen_random_uuid(),
  marketplace_item_id uuid not null references public.marketplace_items(id) on delete restrict,
  creator_account_id uuid not null references public.marketplace_creator_accounts(id) on delete restrict,
  submitted_by uuid null,
  submission_status text not null default 'draft',
  submission_note text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketplace_creator_submissions_status_check
    check (submission_status in ('draft', 'submitted', 'withdrawn', 'rejected', 'approved')),
  constraint marketplace_creator_submissions_note_check
    check (submission_note is null or char_length(submission_note) <= 2000)
);

create index if not exists marketplace_creator_submissions_item_created_idx
  on public.marketplace_creator_submissions(marketplace_item_id, created_at desc);

create index if not exists marketplace_creator_submissions_creator_status_idx
  on public.marketplace_creator_submissions(creator_account_id, submission_status, created_at desc);

alter table public.marketplace_creator_submissions enable row level security;

drop policy if exists "service role can manage marketplace creator submissions" on public.marketplace_creator_submissions;
create policy "service role can manage marketplace creator submissions"
on public.marketplace_creator_submissions
for all
to service_role
using (true)
with check (true);

create or replace function public.marketplace_creator_submissions_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists marketplace_creator_submissions_updated_at on public.marketplace_creator_submissions;
create trigger marketplace_creator_submissions_updated_at
before update on public.marketplace_creator_submissions
for each row
execute function public.marketplace_creator_submissions_set_updated_at();

create or replace function public.marketplace_creator_submissions_guard_metadata()
returns trigger
language plpgsql
as $$
declare
  metadata_text text;
begin
  if new.submission_status not in ('draft', 'submitted', 'withdrawn', 'rejected', 'approved') then
    raise exception 'Invalid marketplace submission_status: %', new.submission_status;
  end if;

  metadata_text := lower(new.metadata::text);

  if metadata_text like '%api_key%' or metadata_text like '%apikey%' then
    raise exception 'Marketplace creator submission metadata must not contain API secrets';
  end if;

  if metadata_text like '%password%' or metadata_text like '%secret%' or metadata_text like '%token%' then
    raise exception 'Marketplace creator submission metadata must not contain secrets';
  end if;

  return new;
end;
$$;

drop trigger if exists marketplace_creator_submissions_guard_metadata on public.marketplace_creator_submissions;
create trigger marketplace_creator_submissions_guard_metadata
before insert or update of metadata, submission_status
on public.marketplace_creator_submissions
for each row
execute function public.marketplace_creator_submissions_guard_metadata();

alter table public.marketplace_items
  add column if not exists submitted_by uuid null,
  add column if not exists submitted_at timestamptz null,
  add column if not exists submission_note text null,
  add column if not exists submission_status text null,
  add column if not exists submission_updated_at timestamptz null;

alter table public.marketplace_items
  drop constraint if exists marketplace_items_submission_status_check;

alter table public.marketplace_items
  add constraint marketplace_items_submission_status_check
  check (
    submission_status is null
    or submission_status in ('draft', 'submitted', 'withdrawn', 'rejected', 'approved')
  );

create index if not exists marketplace_items_submission_status_idx
  on public.marketplace_items(submission_status, submission_updated_at desc nulls last)
  where submission_status is not null;
