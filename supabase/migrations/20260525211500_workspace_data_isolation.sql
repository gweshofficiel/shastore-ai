-- Workspace data isolation for dashboard-owned resources.
-- Additive: public storefront reads remain public where existing policies allow them,
-- while authenticated dashboard access is scoped to workspace memberships.

alter table if exists public.stores
  add column if not exists workspace_id uuid;

alter table if exists public.landing_pages
  add column if not exists workspace_id uuid;

alter table if exists public.products
  add column if not exists workspace_id uuid;

alter table if exists public.landings
  add column if not exists workspace_id uuid;

alter table if exists public.publications
  add column if not exists workspace_id uuid;

alter table if exists public.landing_settings
  add column if not exists workspace_id uuid;

alter table if exists public.landing_payment_methods
  add column if not exists workspace_id uuid;

alter table if exists public.product_images
  add column if not exists workspace_id uuid;

alter table if exists public.published_stores
  add column if not exists workspace_id uuid;

alter table if exists public.store_orders
  add column if not exists workspace_id uuid;

alter table if exists public.domains
  add column if not exists workspace_id uuid;

alter table if exists public.publication_hosts
  add column if not exists workspace_id uuid;

alter table if exists public.dns_verifications
  add column if not exists workspace_id uuid;

alter table if exists public.publish_events
  add column if not exists workspace_id uuid;

alter table if exists public.commerce_orders
  add column if not exists workspace_id uuid;

alter table if exists public.generations
  add column if not exists workspace_id uuid;

alter table if exists public.ai_generations
  add column if not exists workspace_id uuid;

alter table if exists public.templates
  add column if not exists workspace_id uuid;

alter table if exists public.store_templates
  add column if not exists workspace_id uuid;

alter table if exists public.store_products
  add column if not exists workspace_id uuid;

alter table if exists public.store_categories
  add column if not exists workspace_id uuid;

alter table if exists public.store_theme_settings
  add column if not exists workspace_id uuid;

alter table if exists public.store_sections
  add column if not exists workspace_id uuid;

alter table if exists public.store_themes
  add column if not exists workspace_id uuid;

alter table if exists public.store_assets
  add column if not exists workspace_id uuid;

alter table if exists public.store_uploads
  add column if not exists workspace_id uuid;

do $$
begin
  if to_regclass('public.stores') is not null then
    update public.stores
    set workspace_id = coalesce(workspace_id, owner_user_id, user_id)
    where workspace_id is null;

    create index if not exists stores_workspace_id_idx
      on public.stores(workspace_id);
  end if;

  if to_regclass('public.landing_pages') is not null then
    update public.landing_pages
    set workspace_id = coalesce(workspace_id, user_id)
    where workspace_id is null;

    create index if not exists landing_pages_workspace_created_idx
      on public.landing_pages(workspace_id, created_at desc);
  end if;

  if to_regclass('public.products') is not null then
    update public.products
    set workspace_id = coalesce(workspace_id, user_id)
    where workspace_id is null;

    create index if not exists products_workspace_idx
      on public.products(workspace_id);
  end if;

  if to_regclass('public.landings') is not null then
    update public.landings
    set workspace_id = coalesce(workspace_id, user_id)
    where workspace_id is null;
  end if;

  if to_regclass('public.publications') is not null then
    update public.publications
    set workspace_id = coalesce(workspace_id, user_id)
    where workspace_id is null;
  end if;

  if to_regclass('public.landing_settings') is not null then
    update public.landing_settings
    set workspace_id = coalesce(workspace_id, user_id)
    where workspace_id is null;
  end if;

  if to_regclass('public.landing_payment_methods') is not null then
    update public.landing_payment_methods
    set workspace_id = coalesce(workspace_id, user_id)
    where workspace_id is null;
  end if;

  if to_regclass('public.product_images') is not null then
    update public.product_images
    set workspace_id = coalesce(workspace_id, user_id)
    where workspace_id is null;
  end if;

  if to_regclass('public.published_stores') is not null and to_regclass('public.stores') is not null then
    update public.published_stores published
    set workspace_id = coalesce(published.workspace_id, stores.workspace_id, published.user_id)
    from public.stores stores
    where published.store_id = stores.id
      and published.workspace_id is null;

    create index if not exists published_stores_workspace_idx
      on public.published_stores(workspace_id, published_at desc);
  end if;

  if to_regclass('public.store_orders') is not null and to_regclass('public.stores') is not null then
    update public.store_orders orders
    set workspace_id = coalesce(orders.workspace_id, stores.workspace_id, orders.owner_user_id, orders.user_id)
    from public.stores stores
    where orders.store_id = stores.id
      and orders.workspace_id is null;

    create index if not exists store_orders_workspace_created_idx
      on public.store_orders(workspace_id, created_at desc);
  end if;

  if to_regclass('public.store_products') is not null and to_regclass('public.stores') is not null then
    update public.store_products products
    set workspace_id = coalesce(products.workspace_id, stores.workspace_id, products.user_id)
    from public.stores stores
    where products.store_id = stores.id
      and products.workspace_id is null;

    create index if not exists store_products_workspace_idx
      on public.store_products(workspace_id, store_id);
  end if;

  if to_regclass('public.store_categories') is not null and to_regclass('public.stores') is not null then
    update public.store_categories categories
    set workspace_id = coalesce(categories.workspace_id, stores.workspace_id, categories.user_id)
    from public.stores stores
    where categories.store_id = stores.id
      and categories.workspace_id is null;

    create index if not exists store_categories_workspace_idx
      on public.store_categories(workspace_id, store_id);
  end if;

  if to_regclass('public.store_theme_settings') is not null and to_regclass('public.stores') is not null then
    update public.store_theme_settings settings
    set workspace_id = coalesce(settings.workspace_id, stores.workspace_id, settings.user_id)
    from public.stores stores
    where settings.store_id = stores.id
      and settings.workspace_id is null;
  end if;

  if to_regclass('public.ai_generations') is not null then
    update public.ai_generations
    set workspace_id = coalesce(workspace_id, user_id)
    where workspace_id is null;
  end if;

  if to_regclass('public.generations') is not null then
    update public.generations
    set workspace_id = coalesce(workspace_id, user_id)
    where workspace_id is null;
  end if;
end $$;

do $$
begin
  if to_regclass('public.domains') is not null then
    create index if not exists domains_workspace_created_idx
      on public.domains(workspace_id, created_at desc);
  end if;
end $$;

create or replace function public.workspace_can_edit(candidate_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.workspace_member_role(candidate_workspace_id), '') in ('owner', 'admin', 'editor')
    or public.shastore_is_admin();
$$;

grant execute on function public.workspace_can_edit(uuid) to authenticated;

drop policy if exists "workspace members can read landing pages" on public.landing_pages;
drop policy if exists "workspace editors can insert landing pages" on public.landing_pages;
drop policy if exists "workspace editors can update landing pages" on public.landing_pages;
drop policy if exists "workspace editors can delete landing pages" on public.landing_pages;

create policy "workspace members can read landing pages"
on public.landing_pages
for select
to authenticated
using (public.can_access_workspace(workspace_id));

create policy "workspace editors can insert landing pages"
on public.landing_pages
for insert
to authenticated
with check (public.workspace_can_edit(workspace_id));

create policy "workspace editors can update landing pages"
on public.landing_pages
for update
to authenticated
using (public.workspace_can_edit(workspace_id))
with check (public.workspace_can_edit(workspace_id));

create policy "workspace editors can delete landing pages"
on public.landing_pages
for delete
to authenticated
using (public.workspace_can_edit(workspace_id));

drop policy if exists "store owners and workspace members can view stores" on public.stores;
drop policy if exists "workspace members can view stores" on public.stores;
drop policy if exists "workspace editors can create stores" on public.stores;
drop policy if exists "workspace editors can update stores" on public.stores;
drop policy if exists "workspace editors can delete stores" on public.stores;

create policy "workspace members can view stores"
on public.stores
for select
to authenticated
using (
  public.can_access_workspace(workspace_id)
  or auth.uid() = owner_user_id
  or public.shastore_is_admin()
);

create policy "workspace editors can create stores"
on public.stores
for insert
to authenticated
with check (
  public.workspace_can_edit(workspace_id)
  and owner_user_id = auth.uid()
);

create policy "workspace editors can update stores"
on public.stores
for update
to authenticated
using (public.workspace_can_edit(workspace_id))
with check (public.workspace_can_edit(workspace_id));

create policy "workspace editors can delete stores"
on public.stores
for delete
to authenticated
using (public.workspace_can_edit(workspace_id));

drop policy if exists "workspace members read store orders" on public.store_orders;
drop policy if exists "workspace managers update store orders" on public.store_orders;

create policy "workspace members read store orders"
on public.store_orders
for select
to authenticated
using (
  public.can_access_workspace(workspace_id)
  or auth.uid() = owner_user_id
  or auth.uid() = user_id
);

create policy "workspace managers update store orders"
on public.store_orders
for update
to authenticated
using (public.workspace_can_edit(workspace_id))
with check (public.workspace_can_edit(workspace_id));

do $$
begin
  if to_regclass('public.store_products') is not null then
    alter table public.store_products enable row level security;
    drop policy if exists "workspace members read store products" on public.store_products;
    drop policy if exists "workspace editors write store products" on public.store_products;
    drop policy if exists "public can read published store products" on public.store_products;
    create policy "workspace members read store products"
    on public.store_products
    for select
    to authenticated
    using (public.can_access_workspace(workspace_id));
    create policy "public can read published store products"
    on public.store_products
    for select
    to anon, authenticated
    using (
      exists (
        select 1
        from public.stores stores
        where stores.id = store_products.store_id
          and stores.status = 'published'
      )
    );
    create policy "workspace editors write store products"
    on public.store_products
    for all
    to authenticated
    using (public.workspace_can_edit(workspace_id))
    with check (public.workspace_can_edit(workspace_id));
  end if;

  if to_regclass('public.store_categories') is not null then
    alter table public.store_categories enable row level security;
    drop policy if exists "workspace members read store categories" on public.store_categories;
    drop policy if exists "workspace editors write store categories" on public.store_categories;
    drop policy if exists "public can read published store categories" on public.store_categories;
    create policy "workspace members read store categories"
    on public.store_categories
    for select
    to authenticated
    using (public.can_access_workspace(workspace_id));
    create policy "public can read published store categories"
    on public.store_categories
    for select
    to anon, authenticated
    using (
      exists (
        select 1
        from public.stores stores
        where stores.id = store_categories.store_id
          and stores.status = 'published'
      )
    );
    create policy "workspace editors write store categories"
    on public.store_categories
    for all
    to authenticated
    using (public.workspace_can_edit(workspace_id))
    with check (public.workspace_can_edit(workspace_id));
  end if;

  if to_regclass('public.store_theme_settings') is not null then
    alter table public.store_theme_settings enable row level security;
    drop policy if exists "workspace members read store theme settings" on public.store_theme_settings;
    drop policy if exists "workspace editors write store theme settings" on public.store_theme_settings;
    create policy "workspace members read store theme settings"
    on public.store_theme_settings
    for select
    to authenticated
    using (public.can_access_workspace(workspace_id));
    create policy "workspace editors write store theme settings"
    on public.store_theme_settings
    for all
    to authenticated
    using (public.workspace_can_edit(workspace_id))
    with check (public.workspace_can_edit(workspace_id));
  end if;

  if to_regclass('public.generations') is not null then
    alter table public.generations enable row level security;
    drop policy if exists "workspace members read generations" on public.generations;
    drop policy if exists "workspace members write generations" on public.generations;
    create policy "workspace members read generations"
    on public.generations
    for select
    to authenticated
    using (public.can_access_workspace(workspace_id));
    create policy "workspace members write generations"
    on public.generations
    for insert
    to authenticated
    with check (public.can_access_workspace(workspace_id));
  end if;
end $$;
