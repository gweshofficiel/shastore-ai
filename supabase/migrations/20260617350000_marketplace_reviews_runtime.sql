-- MP-24: Marketplace reviews and ratings runtime foundation.
-- Additive review records only. No payouts or revenue sharing execution.

create table if not exists public.marketplace_reviews (
  id uuid primary key default gen_random_uuid(),
  marketplace_item_id uuid not null references public.marketplace_items(id) on delete restrict,
  marketplace_purchase_id uuid not null references public.marketplace_purchases(id) on delete restrict,
  reviewer_account_id uuid null references auth.users(id) on delete set null,
  rating integer not null,
  review_title text not null default '',
  review_body text not null default '',
  review_status text not null default 'draft',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketplace_reviews_review_status_check
    check (review_status in ('draft', 'published', 'hidden', 'flagged', 'archived')),
  constraint marketplace_reviews_rating_check
    check (rating >= 1 and rating <= 5),
  constraint marketplace_reviews_title_length_check
    check (char_length(review_title) <= 200),
  constraint marketplace_reviews_body_length_check
    check (char_length(review_body) <= 5000)
);

create unique index if not exists marketplace_reviews_published_purchase_idx
  on public.marketplace_reviews(marketplace_purchase_id)
  where review_status = 'published';

create index if not exists marketplace_reviews_item_created_idx
  on public.marketplace_reviews(marketplace_item_id, created_at desc);

create index if not exists marketplace_reviews_item_status_rating_idx
  on public.marketplace_reviews(marketplace_item_id, review_status, rating);

create index if not exists marketplace_reviews_reviewer_created_idx
  on public.marketplace_reviews(reviewer_account_id, created_at desc)
  where reviewer_account_id is not null;

create index if not exists marketplace_reviews_status_created_idx
  on public.marketplace_reviews(review_status, created_at desc);

alter table public.marketplace_reviews enable row level security;

drop policy if exists "service role can manage marketplace reviews" on public.marketplace_reviews;
create policy "service role can manage marketplace reviews"
on public.marketplace_reviews
for all
to service_role
using (true)
with check (true);

create or replace function public.marketplace_reviews_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists marketplace_reviews_updated_at on public.marketplace_reviews;
create trigger marketplace_reviews_updated_at
before update on public.marketplace_reviews
for each row
execute function public.marketplace_reviews_set_updated_at();

create or replace function public.marketplace_reviews_guard_metadata()
returns trigger
language plpgsql
as $$
declare
  metadata_text text;
begin
  if new.review_status not in ('draft', 'published', 'hidden', 'flagged', 'archived') then
    raise exception 'Invalid marketplace review_status: %', new.review_status;
  end if;

  if coalesce(new.rating, 0) < 1 or coalesce(new.rating, 0) > 5 then
    raise exception 'Marketplace review rating must be between 1 and 5';
  end if;

  if char_length(coalesce(new.review_title, '')) > 200 then
    raise exception 'Marketplace review title exceeds maximum length';
  end if;

  if char_length(coalesce(new.review_body, '')) > 5000 then
    raise exception 'Marketplace review body exceeds maximum length';
  end if;

  metadata_text := lower(new.metadata::text);

  if metadata_text like '%api_key%' or metadata_text like '%apikey%' then
    raise exception 'Marketplace review metadata must not contain API secrets';
  end if;

  if metadata_text like '%password%' or metadata_text like '%secret%' or metadata_text like '%token%' then
    raise exception 'Marketplace review metadata must not contain secrets';
  end if;

  if metadata_text like '%card_number%' or metadata_text like '%cvv%' or metadata_text like '%cvc%' then
    raise exception 'Marketplace review metadata must not contain card data';
  end if;

  if metadata_text like '%payout%' or metadata_text like '%bank_account%' or metadata_text like '%iban%' then
    raise exception 'Marketplace review metadata must not contain payout credentials';
  end if;

  if metadata_text like '%moderation_note%' or metadata_text like '%internal_note%' then
    raise exception 'Marketplace review metadata must not contain internal moderation notes';
  end if;

  if metadata_text like '%<script%' or metadata_text like '%javascript:%' then
    raise exception 'Marketplace review metadata must not contain executable content';
  end if;

  return new;
end;
$$;

drop trigger if exists marketplace_reviews_guard_metadata on public.marketplace_reviews;
create trigger marketplace_reviews_guard_metadata
before insert or update of metadata, review_status, rating, review_title, review_body
on public.marketplace_reviews
for each row
execute function public.marketplace_reviews_guard_metadata();
