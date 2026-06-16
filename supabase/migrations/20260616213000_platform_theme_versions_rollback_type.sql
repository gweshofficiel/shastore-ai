-- Add rollback snapshot type for platform theme version history.
-- Additive only: extends platform_theme_versions constraint only.

alter table public.platform_theme_versions
  drop constraint if exists platform_theme_versions_snapshot_type_check;

alter table public.platform_theme_versions
  add constraint platform_theme_versions_snapshot_type_check
  check (snapshot_type in (
    'draft_saved',
    'published',
    'asset_uploaded',
    'manual_snapshot',
    'rollback_to_draft'
  ));
