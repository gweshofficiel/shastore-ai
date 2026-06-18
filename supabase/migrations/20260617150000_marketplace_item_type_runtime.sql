-- MP-2: Marketplace item type runtime hardening.
-- Additive section/type consistency guard; preserves existing MP-1 data.

alter table public.marketplace_items
  drop constraint if exists marketplace_items_section_item_type_check;

alter table public.marketplace_items
  add constraint marketplace_items_section_item_type_check
  check (
    (item_type = 'template' and section = 'template_marketplace')
    or (item_type = 'theme' and section = 'theme_marketplace')
    or (item_type = 'plugin' and section = 'plugin_marketplace')
    or (item_type = 'app' and section = 'app_marketplace')
    or (item_type = 'service' and section = 'service_marketplace')
  );

create index if not exists marketplace_items_item_type_section_idx
  on public.marketplace_items(item_type, section, updated_at desc);

create or replace function public.marketplace_items_guard_item_type()
returns trigger
language plpgsql
as $$
begin
  if new.item_type not in ('template', 'theme', 'plugin', 'app', 'service') then
    raise exception 'Invalid marketplace item_type: %', new.item_type;
  end if;

  if not (
    (new.item_type = 'template' and new.section = 'template_marketplace')
    or (new.item_type = 'theme' and new.section = 'theme_marketplace')
    or (new.item_type = 'plugin' and new.section = 'plugin_marketplace')
    or (new.item_type = 'app' and new.section = 'app_marketplace')
    or (new.item_type = 'service' and new.section = 'service_marketplace')
  ) then
    raise exception 'Marketplace item_type % does not match section %', new.item_type, new.section;
  end if;

  return new;
end;
$$;

drop trigger if exists marketplace_items_guard_item_type on public.marketplace_items;
create trigger marketplace_items_guard_item_type
before insert or update of item_type, section
on public.marketplace_items
for each row
execute function public.marketplace_items_guard_item_type();
