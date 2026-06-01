-- Storefront product Q&A foundation.
-- Additive only: store/product scoped questions with seller answer moderation.

create table if not exists public.product_questions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  store_id uuid not null references public.stores(id) on delete cascade,
  product_id uuid not null references public.store_products(id) on delete cascade,
  customer_name text,
  customer_email text,
  question_text text not null check (char_length(trim(question_text)) between 10 and 2000),
  answer_text text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'hidden')),
  answered_at timestamptz,
  moderated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists product_questions_store_status_idx
on public.product_questions(workspace_id, store_id, status, created_at desc);

create index if not exists product_questions_product_status_idx
on public.product_questions(store_id, product_id, status, created_at desc);

alter table public.product_questions enable row level security;

drop policy if exists "workspace members read product questions" on public.product_questions;
drop policy if exists "workspace editors manage product questions" on public.product_questions;

create policy "workspace members read product questions"
on public.product_questions
for select
to authenticated
using (public.can_access_workspace(workspace_id));

create policy "workspace editors manage product questions"
on public.product_questions
for all
to authenticated
using (public.workspace_can_edit(workspace_id))
with check (public.workspace_can_edit(workspace_id));
