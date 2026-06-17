-- Add changes_requested approval status for marketplace listing review workflow.
-- Additive only: extends TM-17 approval_status constraint.

alter table public.template_marketplace_listings
  drop constraint if exists template_marketplace_listings_approval_status_check;

alter table public.template_marketplace_listings
  add constraint template_marketplace_listings_approval_status_check
    check (approval_status in ('pending_review', 'approved', 'rejected', 'changes_requested'));
