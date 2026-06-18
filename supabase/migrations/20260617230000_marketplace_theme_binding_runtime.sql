-- MP-10: Marketplace theme binding runtime.
-- Additive binding metadata on marketplace_items. Reuses linked_theme_id -> platform_theme_presets.

alter table public.marketplace_items
  add column if not exists theme_version text null,
  add column if not exists theme_binding_status text null,
  add column if not exists theme_binding_updated_at timestamptz null;

update public.marketplace_items mi
set linked_theme_id = pt.id
from public.platform_theme_presets pt
where mi.item_type = 'theme'
  and mi.linked_theme_id is null
  and mi.item_key = 'theme:' || pt.preset_key;

update public.marketplace_items mi
set linked_theme_id = pt.id
from public.platform_theme_presets pt
where mi.item_type = 'theme'
  and mi.linked_theme_id is null
  and mi.item_key = 'theme:platform-brand-pack'
  and pt.preset_key = 'default';

update public.marketplace_items mi
set
  theme_version = coalesce(to_char(pt.updated_at, 'YYYY-MM-DD'), '1'),
  theme_binding_status = 'bound',
  theme_binding_updated_at = now()
from public.platform_theme_presets pt
where mi.item_type = 'theme'
  and mi.linked_theme_id = pt.id
  and mi.theme_binding_status is null;

update public.marketplace_items
set
  theme_binding_status = 'orphaned',
  theme_binding_updated_at = coalesce(theme_binding_updated_at, now())
where item_type = 'theme'
  and linked_theme_id is not null
  and not exists (
    select 1
    from public.platform_theme_presets pt
    where pt.id = marketplace_items.linked_theme_id
  );

update public.marketplace_items
set
  theme_binding_status = 'unbound',
  theme_binding_updated_at = coalesce(theme_binding_updated_at, now())
where item_type = 'theme'
  and linked_theme_id is null
  and theme_binding_status is null;

alter table public.marketplace_items
  drop constraint if exists marketplace_items_theme_binding_status_check;

alter table public.marketplace_items
  add constraint marketplace_items_theme_binding_status_check
  check (
    theme_binding_status is null
    or theme_binding_status in ('bound', 'invalid', 'orphaned', 'unbound')
  );

alter table public.marketplace_items
  drop constraint if exists marketplace_items_linked_theme_id_fkey;

alter table public.marketplace_items
  add constraint marketplace_items_linked_theme_id_fkey
  foreign key (linked_theme_id) references public.platform_theme_presets(id) on delete restrict;

create index if not exists marketplace_items_theme_binding_idx
  on public.marketplace_items(item_type, theme_binding_status, theme_binding_updated_at desc nulls last)
  where item_type = 'theme';

create or replace function public.marketplace_items_guard_theme_binding()
returns trigger
language plpgsql
as $$
begin
  if new.item_type = 'theme' then
    if new.linked_theme_id is null then
      raise exception 'Theme marketplace items require linked_theme_id';
    end if;

    if not exists (
      select 1
      from public.platform_theme_presets pt
      where pt.id = new.linked_theme_id
    ) then
      raise exception 'Theme marketplace items require a valid platform_theme_presets reference';
    end if;

    if new.theme_binding_status is null then
      new.theme_binding_status := 'bound';
    end if;

    if new.theme_binding_updated_at is null then
      new.theme_binding_updated_at := now();
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists marketplace_items_guard_theme_binding on public.marketplace_items;
create trigger marketplace_items_guard_theme_binding
before insert or update of item_type, linked_theme_id, theme_binding_status
on public.marketplace_items
for each row
execute function public.marketplace_items_guard_theme_binding();
