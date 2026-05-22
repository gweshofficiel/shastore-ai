-- SHASTORE AI real multi-tenant store management foundation.
-- Additive only: attaches management records to store_instances without changing
-- buyer claim, reseller provisioning, transfer, activation, PDF, auth, or RLS foundations.

create extension if not exists "pgcrypto";

create or replace function public.can_access_store_instance(candidate_store_instance_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.store_instances instances
    where instances.id = candidate_store_instance_id
      and (
        instances.owner_user_id = auth.uid()
        or instances.reseller_user_id = auth.uid()
        or exists (
          select 1
          from public.store_owner_links links
          where links.store_instance_id = instances.id
            and links.buyer_user_id = auth.uid()
            and links.ownership_status in ('claimed', 'active')
        )
        or exists (
          select 1
          from public.store_access_permissions permissions
          where permissions.store_instance_id = instances.id
            and permissions.buyer_user_id = auth.uid()
            and permissions.access_status = 'active'
        )
      )
  );
$$;

create or replace function public.can_manage_store_instance(candidate_store_instance_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.store_instances instances
    where instances.id = candidate_store_instance_id
      and (
        instances.owner_user_id = auth.uid()
        or instances.reseller_user_id = auth.uid()
        or exists (
          select 1
          from public.store_owner_links links
          where links.store_instance_id = instances.id
            and links.buyer_user_id = auth.uid()
            and links.ownership_status in ('claimed', 'active')
            and links.owner_role in ('primary_owner', 'owner', 'team_owner')
        )
        or exists (
          select 1
          from public.store_access_permissions permissions
          where permissions.store_instance_id = instances.id
            and permissions.buyer_user_id = auth.uid()
            and permissions.access_status = 'active'
            and permissions.access_role in ('owner', 'admin')
        )
      )
  );
$$;

create table if not exists public.store_settings (
  id uuid primary key default gen_random_uuid(),
  store_instance_id uuid not null unique references public.store_instances(id) on delete cascade,
  store_name text not null,
  store_slug text not null unique,
  store_description text,
  store_logo_url text,
  store_favicon_url text,
  support_email text,
  store_phone text,
  timezone text not null default 'UTC',
  language text not null default 'en',
  currency text not null default 'USD',
  seo_title text,
  seo_description text,
  store_status text not null default 'draft'
    check (store_status in ('draft', 'active', 'suspended', 'archived')),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.store_settings
  add column if not exists seo_title text,
  add column if not exists seo_description text;

insert into storage.buckets (id, name, public)
values ('store-media', 'store-media', true)
on conflict (id) do update
  set public = excluded.public;

create table if not exists public.store_branding (
  id uuid primary key default gen_random_uuid(),
  store_instance_id uuid not null unique references public.store_instances(id) on delete cascade,
  primary_color text not null default '#0f172a',
  secondary_color text not null default '#2563eb',
  typography jsonb not null default '{"heading":"inter","body":"inter","scale":"comfortable"}'::jsonb,
  theme_mode text not null default 'light'
    check (theme_mode in ('light', 'dark', 'system')),
  custom_css text,
  branding_assets jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.store_plan_limits (
  plan_id text primary key check (plan_id in ('starter', 'pro', 'enterprise')),
  plan_name text not null,
  products_limit integer,
  storage_mb_limit integer,
  domains_limit integer,
  monthly_traffic_limit integer,
  ai_usage_limit integer,
  features jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.store_subscriptions (
  id uuid primary key default gen_random_uuid(),
  store_instance_id uuid not null unique references public.store_instances(id) on delete cascade,
  plan_id text not null references public.store_plan_limits(plan_id),
  subscription_status text not null default 'active'
    check (subscription_status in ('trialing', 'active', 'past_due', 'cancelled', 'suspended')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  billing_provider text,
  billing_reference text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.store_usage_tracking (
  id uuid primary key default gen_random_uuid(),
  store_instance_id uuid not null references public.store_instances(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  products_count integer not null default 0,
  storage_mb_used numeric not null default 0,
  domains_count integer not null default 0,
  monthly_traffic_count integer not null default 0,
  ai_usage_count integer not null default 0,
  usage_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_instance_id, period_start, period_end)
);

create table if not exists public.store_domains (
  id uuid primary key default gen_random_uuid(),
  store_instance_id uuid not null references public.store_instances(id) on delete cascade,
  domain_type text not null default 'subdomain'
    check (domain_type in ('subdomain', 'custom')),
  hostname text not null unique,
  is_primary boolean not null default false,
  dns_status text not null default 'not_configured'
    check (dns_status in ('not_configured', 'pending', 'verified', 'failed')),
  ssl_status text not null default 'not_configured'
    check (ssl_status in ('not_configured', 'pending', 'active', 'failed')),
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'verified', 'failed', 'revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_instance_id, hostname)
);

create table if not exists public.domain_verifications (
  id uuid primary key default gen_random_uuid(),
  store_domain_id uuid not null references public.store_domains(id) on delete cascade,
  verification_type text not null default 'dns_txt'
    check (verification_type in ('dns_txt', 'cname', 'http_file')),
  record_name text not null,
  record_type text not null default 'TXT',
  record_value text not null,
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'verified', 'failed', 'expired')),
  checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.store_roles (
  id uuid primary key default gen_random_uuid(),
  store_instance_id uuid not null references public.store_instances(id) on delete cascade,
  role_key text not null check (role_key in ('owner', 'admin', 'editor', 'support')),
  role_name text not null,
  role_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_instance_id, role_key)
);

create table if not exists public.store_permissions (
  id uuid primary key default gen_random_uuid(),
  store_instance_id uuid not null references public.store_instances(id) on delete cascade,
  role_key text not null check (role_key in ('owner', 'admin', 'editor', 'support')),
  permission_key text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_instance_id, role_key, permission_key)
);

create table if not exists public.store_staff (
  id uuid primary key default gen_random_uuid(),
  store_instance_id uuid not null references public.store_instances(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  staff_email text not null,
  staff_name text,
  role_key text not null default 'support'
    check (role_key in ('owner', 'admin', 'editor', 'support')),
  staff_status text not null default 'invited'
    check (staff_status in ('invited', 'active', 'suspended', 'revoked')),
  invited_by uuid references auth.users(id) on delete set null,
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_instance_id, staff_email)
);

create table if not exists public.store_media_folders (
  id uuid primary key default gen_random_uuid(),
  store_instance_id uuid not null references public.store_instances(id) on delete cascade,
  parent_folder_id uuid references public.store_media_folders(id) on delete cascade,
  folder_name text not null,
  folder_path text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_instance_id, folder_path)
);

create table if not exists public.store_media (
  id uuid primary key default gen_random_uuid(),
  store_instance_id uuid not null references public.store_instances(id) on delete cascade,
  folder_id uuid references public.store_media_folders(id) on delete set null,
  file_name text not null,
  file_path text not null,
  file_type text not null,
  mime_type text,
  file_size_bytes bigint not null default 0,
  public_url text,
  alt_text text,
  media_metadata jsonb not null default '{}'::jsonb,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_instance_id, file_path)
);

create table if not exists public.store_uploads (
  id uuid primary key default gen_random_uuid(),
  store_instance_id uuid not null references public.store_instances(id) on delete cascade,
  media_id uuid references public.store_media(id) on delete set null,
  upload_status text not null default 'pending'
    check (upload_status in ('pending', 'processing', 'completed', 'failed')),
  storage_bucket text,
  storage_path text,
  error_message text,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.store_plan_limits (
  plan_id,
  plan_name,
  products_limit,
  storage_mb_limit,
  domains_limit,
  monthly_traffic_limit,
  ai_usage_limit,
  features
)
values
  ('starter', 'Starter', 100, 1024, 1, 10000, 100, '{"staff":2,"mediaFolders":true}'::jsonb),
  ('pro', 'Pro', 1000, 10240, 5, 100000, 1000, '{"staff":10,"mediaFolders":true,"customCss":true}'::jsonb),
  ('enterprise', 'Enterprise', null, null, null, null, null, '{"staff":"unlimited","mediaFolders":true,"customCss":true,"prioritySupport":true}'::jsonb)
on conflict (plan_id) do update
  set plan_name = excluded.plan_name,
      products_limit = excluded.products_limit,
      storage_mb_limit = excluded.storage_mb_limit,
      domains_limit = excluded.domains_limit,
      monthly_traffic_limit = excluded.monthly_traffic_limit,
      ai_usage_limit = excluded.ai_usage_limit,
      features = excluded.features,
      updated_at = now();

create index if not exists store_settings_instance_idx on public.store_settings(store_instance_id);
create index if not exists store_settings_slug_idx on public.store_settings(store_slug);
create index if not exists store_branding_instance_idx on public.store_branding(store_instance_id);
create index if not exists store_subscriptions_instance_idx on public.store_subscriptions(store_instance_id);
create index if not exists store_usage_tracking_instance_period_idx on public.store_usage_tracking(store_instance_id, period_start desc);
create index if not exists store_domains_instance_idx on public.store_domains(store_instance_id);
create index if not exists store_domains_hostname_idx on public.store_domains(hostname);
create index if not exists domain_verifications_domain_idx on public.domain_verifications(store_domain_id);
create index if not exists store_staff_instance_idx on public.store_staff(store_instance_id);
create index if not exists store_staff_user_idx on public.store_staff(user_id, staff_status);
create index if not exists store_roles_instance_idx on public.store_roles(store_instance_id);
create index if not exists store_permissions_instance_idx on public.store_permissions(store_instance_id);
create index if not exists store_media_folders_instance_idx on public.store_media_folders(store_instance_id);
create index if not exists store_media_instance_idx on public.store_media(store_instance_id, created_at desc);
create index if not exists store_uploads_instance_idx on public.store_uploads(store_instance_id, created_at desc);

alter table public.store_settings enable row level security;
alter table public.store_branding enable row level security;
alter table public.store_plan_limits enable row level security;
alter table public.store_subscriptions enable row level security;
alter table public.store_usage_tracking enable row level security;
alter table public.store_domains enable row level security;
alter table public.domain_verifications enable row level security;
alter table public.store_staff enable row level security;
alter table public.store_roles enable row level security;
alter table public.store_permissions enable row level security;
alter table public.store_media_folders enable row level security;
alter table public.store_media enable row level security;
alter table public.store_uploads enable row level security;

create or replace function public.can_access_store_instance(candidate_store_instance_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.store_instances instances
    where instances.id = candidate_store_instance_id
      and (
        instances.owner_user_id = auth.uid()
        or instances.reseller_user_id = auth.uid()
        or exists (
          select 1
          from public.store_owner_links links
          where links.store_instance_id = instances.id
            and links.buyer_user_id = auth.uid()
            and links.ownership_status in ('claimed', 'active')
        )
        or exists (
          select 1
          from public.store_access_permissions permissions
          where permissions.store_instance_id = instances.id
            and permissions.buyer_user_id = auth.uid()
            and permissions.access_status = 'active'
        )
        or exists (
          select 1
          from public.store_staff staff
          where staff.store_instance_id = instances.id
            and staff.user_id = auth.uid()
            and staff.staff_status = 'active'
        )
      )
  );
$$;

create or replace function public.can_manage_store_instance(candidate_store_instance_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.store_instances instances
    where instances.id = candidate_store_instance_id
      and (
        instances.owner_user_id = auth.uid()
        or instances.reseller_user_id = auth.uid()
        or exists (
          select 1
          from public.store_owner_links links
          where links.store_instance_id = instances.id
            and links.buyer_user_id = auth.uid()
            and links.ownership_status in ('claimed', 'active')
            and links.owner_role in ('primary_owner', 'owner', 'team_owner')
        )
        or exists (
          select 1
          from public.store_access_permissions permissions
          where permissions.store_instance_id = instances.id
            and permissions.buyer_user_id = auth.uid()
            and permissions.access_status = 'active'
            and permissions.access_role in ('owner', 'admin')
        )
        or exists (
          select 1
          from public.store_staff staff
          where staff.store_instance_id = instances.id
            and staff.user_id = auth.uid()
            and staff.staff_status = 'active'
            and staff.role_key in ('owner', 'admin')
        )
      )
  );
$$;

do $$
declare
  managed_table text;
begin
  foreach managed_table in array array[
    'store_settings',
    'store_branding',
    'store_subscriptions',
    'store_usage_tracking',
    'store_domains',
    'store_staff',
    'store_roles',
    'store_permissions',
    'store_media_folders',
    'store_media',
    'store_uploads'
  ]
  loop
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = managed_table
        and policyname = 'Store members read own store management records'
    ) then
      execute format(
        'create policy "Store members read own store management records" on public.%I for select using (public.can_access_store_instance(store_instance_id))',
        managed_table
      );
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = managed_table
        and policyname = 'Store managers write own store management records'
    ) then
      execute format(
        'create policy "Store managers write own store management records" on public.%I for all using (public.can_manage_store_instance(store_instance_id)) with check (public.can_manage_store_instance(store_instance_id))',
        managed_table
      );
    end if;
  end loop;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'store_plan_limits'
      and policyname = 'Authenticated users read store plan limits'
  ) then
    create policy "Authenticated users read store plan limits"
      on public.store_plan_limits for select
      using (auth.uid() is not null);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'domain_verifications'
      and policyname = 'Store members read own domain verifications'
  ) then
    create policy "Store members read own domain verifications"
      on public.domain_verifications for select
      using (
        exists (
          select 1 from public.store_domains domains
          where domains.id = domain_verifications.store_domain_id
            and public.can_access_store_instance(domains.store_instance_id)
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'domain_verifications'
      and policyname = 'Store managers write own domain verifications'
  ) then
    create policy "Store managers write own domain verifications"
      on public.domain_verifications for all
      using (
        exists (
          select 1 from public.store_domains domains
          where domains.id = domain_verifications.store_domain_id
            and public.can_manage_store_instance(domains.store_instance_id)
        )
      )
      with check (
        exists (
          select 1 from public.store_domains domains
          where domains.id = domain_verifications.store_domain_id
            and public.can_manage_store_instance(domains.store_instance_id)
        )
      );
  end if;
end $$;

create or replace function public.ensure_store_management_defaults(candidate_store_instance_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  instance_row public.store_instances%rowtype;
begin
  if not public.can_manage_store_instance(candidate_store_instance_id) then
    raise exception 'not authorized to manage this store';
  end if;

  select *
    into instance_row
  from public.store_instances
  where id = candidate_store_instance_id;

  if instance_row.id is null then
    raise exception 'store instance not found';
  end if;

  insert into public.store_settings (
    store_instance_id,
    store_name,
    store_slug,
    store_status
  )
  values (
    instance_row.id,
    instance_row.store_name,
    instance_row.internal_slug,
    case
      when instance_row.status in ('transferred', 'delivered') then 'active'
      else 'draft'
    end
  )
  on conflict (store_instance_id) do nothing;

  insert into public.store_branding (store_instance_id)
  values (instance_row.id)
  on conflict (store_instance_id) do nothing;

  insert into public.store_subscriptions (store_instance_id, plan_id, subscription_status)
  values (instance_row.id, 'starter', 'active')
  on conflict (store_instance_id) do nothing;

  insert into public.store_roles (store_instance_id, role_key, role_name, role_description)
  values
    (instance_row.id, 'owner', 'Owner', 'Full store ownership and billing access.'),
    (instance_row.id, 'admin', 'Admin', 'Manage store settings, catalog, staff, media, and domains.'),
    (instance_row.id, 'editor', 'Editor', 'Manage catalog, content, media, and branding.'),
    (instance_row.id, 'support', 'Support', 'View orders and support customer workflows.')
  on conflict (store_instance_id, role_key) do nothing;

  insert into public.store_permissions (store_instance_id, role_key, permission_key, enabled)
  values
    (instance_row.id, 'owner', 'store.manage_all', true),
    (instance_row.id, 'admin', 'store.manage_settings', true),
    (instance_row.id, 'admin', 'store.manage_staff', true),
    (instance_row.id, 'admin', 'store.manage_domains', true),
    (instance_row.id, 'editor', 'store.manage_branding', true),
    (instance_row.id, 'editor', 'store.manage_media', true),
    (instance_row.id, 'support', 'store.view_support', true)
  on conflict (store_instance_id, role_key, permission_key) do nothing;
end;
$$;

create or replace function public.get_store_management_snapshot(candidate_store_instance_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.can_access_store_instance(candidate_store_instance_id) then
    return null;
  end if;

  select jsonb_build_object(
    'settings', coalesce(to_jsonb(settings.*), '{}'::jsonb),
    'branding', coalesce(to_jsonb(branding.*), '{}'::jsonb),
    'subscription', coalesce(to_jsonb(subscription.*), '{}'::jsonb),
    'planLimits', coalesce(to_jsonb(limits.*), '{}'::jsonb),
    'domains', coalesce((
      select jsonb_agg(to_jsonb(domains.*) order by domains.is_primary desc, domains.created_at desc)
      from public.store_domains domains
      where domains.store_instance_id = instances.id
    ), '[]'::jsonb),
    'staff', coalesce((
      select jsonb_agg(to_jsonb(staff.*) order by staff.created_at desc)
      from public.store_staff staff
      where staff.store_instance_id = instances.id
    ), '[]'::jsonb),
    'roles', coalesce((
      select jsonb_agg(to_jsonb(roles.*) order by roles.role_key)
      from public.store_roles roles
      where roles.store_instance_id = instances.id
    ), '[]'::jsonb),
    'media', coalesce((
      select jsonb_agg(to_jsonb(media.*) order by media.created_at desc)
      from public.store_media media
      where media.store_instance_id = instances.id
      limit 50
    ), '[]'::jsonb),
    'usage', coalesce((
      select jsonb_agg(to_jsonb(usage.*) order by usage.period_start desc)
      from public.store_usage_tracking usage
      where usage.store_instance_id = instances.id
      limit 12
    ), '[]'::jsonb)
  )
    into result
  from public.store_instances instances
  left join public.store_settings settings on settings.store_instance_id = instances.id
  left join public.store_branding branding on branding.store_instance_id = instances.id
  left join public.store_subscriptions subscription on subscription.store_instance_id = instances.id
  left join public.store_plan_limits limits on limits.plan_id = subscription.plan_id
  where instances.id = candidate_store_instance_id;

  return result;
end;
$$;

do $$
declare
  trigger_table text;
begin
  if exists (select 1 from pg_proc where proname = 'set_store_instances_updated_at') then
    foreach trigger_table in array array[
      'store_settings',
      'store_branding',
      'store_plan_limits',
      'store_subscriptions',
      'store_usage_tracking',
      'store_domains',
      'domain_verifications',
      'store_staff',
      'store_roles',
      'store_permissions',
      'store_media_folders',
      'store_media',
      'store_uploads'
    ]
    loop
      if not exists (
        select 1
        from pg_trigger
        where tgname = trigger_table || '_updated_at'
      ) then
        execute format(
          'create trigger %I before update on public.%I for each row execute function public.set_store_instances_updated_at()',
          trigger_table || '_updated_at',
          trigger_table
        );
      end if;
    end loop;
  end if;
end $$;
