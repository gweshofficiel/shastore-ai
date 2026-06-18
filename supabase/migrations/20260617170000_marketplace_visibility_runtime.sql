-- MP-4: Marketplace visibility runtime hardening.
-- Migrates legacy visibility values and enforces private/internal/public only.

update public.marketplace_items
set visibility = 'private'
where visibility in ('owner', 'reseller');

update public.marketplace_items
set visibility = 'public'
where visibility = 'marketplace';

alter table public.marketplace_items
  drop constraint if exists marketplace_items_visibility_check;

alter table public.marketplace_items
  add constraint marketplace_items_visibility_check
  check (visibility in ('private', 'internal', 'public'));

create index if not exists marketplace_items_visibility_status_idx
  on public.marketplace_items(visibility, status, updated_at desc);

create or replace function public.marketplace_items_guard_visibility()
returns trigger
language plpgsql
as $$
begin
  if new.visibility not in ('private', 'internal', 'public') then
    raise exception 'Invalid marketplace visibility: %', new.visibility;
  end if;

  return new;
end;
$$;

drop trigger if exists marketplace_items_guard_visibility on public.marketplace_items;
create trigger marketplace_items_guard_visibility
before insert or update of visibility
on public.marketplace_items
for each row
execute function public.marketplace_items_guard_visibility();
