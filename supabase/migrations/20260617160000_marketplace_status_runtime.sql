-- MP-3: Marketplace status runtime hardening.
-- Additive status guard; preserves existing MP-1/MP-2 data and constraints.

create index if not exists marketplace_items_status_idx
  on public.marketplace_items(status, updated_at desc);

create or replace function public.marketplace_items_guard_status()
returns trigger
language plpgsql
as $$
begin
  if new.status not in ('draft', 'pending_review', 'approved', 'rejected', 'archived') then
    raise exception 'Invalid marketplace status: %', new.status;
  end if;

  return new;
end;
$$;

drop trigger if exists marketplace_items_guard_status on public.marketplace_items;
create trigger marketplace_items_guard_status
before insert or update of status
on public.marketplace_items
for each row
execute function public.marketplace_items_guard_status();
