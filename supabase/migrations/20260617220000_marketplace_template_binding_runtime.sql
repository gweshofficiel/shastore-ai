-- MP-9: Marketplace template binding runtime.
-- Additive binding metadata on marketplace_items. Reuses linked_template_id.

alter table public.marketplace_items
  add column if not exists template_version text null,
  add column if not exists template_binding_status text null,
  add column if not exists template_binding_updated_at timestamptz null;

update public.marketplace_items mi
set linked_template_id = tr.id
from public.template_registry tr
where mi.item_type = 'template'
  and mi.linked_template_id is null
  and mi.item_key = 'template:' || tr.template_key;

update public.marketplace_items mi
set
  template_version = tr.version,
  template_binding_status = 'bound',
  template_binding_updated_at = now()
from public.template_registry tr
where mi.item_type = 'template'
  and mi.linked_template_id = tr.id
  and mi.template_binding_status is null;

update public.marketplace_items
set
  template_binding_status = 'orphaned',
  template_binding_updated_at = coalesce(template_binding_updated_at, now())
where item_type = 'template'
  and linked_template_id is not null
  and not exists (
    select 1
    from public.template_registry tr
    where tr.id = marketplace_items.linked_template_id
  );

update public.marketplace_items
set
  template_binding_status = 'unbound',
  template_binding_updated_at = coalesce(template_binding_updated_at, now())
where item_type = 'template'
  and linked_template_id is null
  and template_binding_status is null;

alter table public.marketplace_items
  drop constraint if exists marketplace_items_template_binding_status_check;

alter table public.marketplace_items
  add constraint marketplace_items_template_binding_status_check
  check (
    template_binding_status is null
    or template_binding_status in ('bound', 'invalid', 'orphaned', 'unbound')
  );

create index if not exists marketplace_items_template_binding_idx
  on public.marketplace_items(item_type, template_binding_status, template_binding_updated_at desc nulls last)
  where item_type = 'template';

create or replace function public.marketplace_items_guard_template_binding()
returns trigger
language plpgsql
as $$
begin
  if new.item_type = 'template' then
    if new.linked_template_id is null then
      raise exception 'Template marketplace items require linked_template_id';
    end if;

    if not exists (
      select 1
      from public.template_registry tr
      where tr.id = new.linked_template_id
    ) then
      raise exception 'Template marketplace items require a valid template_registry reference';
    end if;

    if new.template_binding_status is null then
      new.template_binding_status := 'bound';
    end if;

    if new.template_binding_updated_at is null then
      new.template_binding_updated_at := now();
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists marketplace_items_guard_template_binding on public.marketplace_items;
create trigger marketplace_items_guard_template_binding
before insert or update of item_type, linked_template_id, template_binding_status
on public.marketplace_items
for each row
execute function public.marketplace_items_guard_template_binding();
