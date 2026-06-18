-- MP-5: Marketplace approval runtime metadata.
-- Additive approval audit columns only.

alter table public.marketplace_items
  add column if not exists approved_by uuid null,
  add column if not exists approved_at timestamptz null,
  add column if not exists rejected_by uuid null,
  add column if not exists rejected_at timestamptz null,
  add column if not exists reviewed_by uuid null,
  add column if not exists reviewed_at timestamptz null,
  add column if not exists approval_note text null,
  add column if not exists approval_action text null,
  add column if not exists approval_updated_at timestamptz null;

alter table public.marketplace_items
  drop constraint if exists marketplace_items_approval_action_check;

alter table public.marketplace_items
  add constraint marketplace_items_approval_action_check
  check (
    approval_action is null
    or approval_action in (
      'submit_for_review',
      'approve',
      'reject',
      'archive',
      'restore_to_draft'
    )
  );

create index if not exists marketplace_items_approval_updated_idx
  on public.marketplace_items(approval_action, approval_updated_at desc nulls last);
