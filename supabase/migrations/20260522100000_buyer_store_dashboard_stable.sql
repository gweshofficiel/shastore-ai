-- Buyer store owner dashboard: core management tables, RLS, and provisioning RPCs.
-- Timestamped so `supabase db push` applies this migration (non-timestamped *-safe.sql files are skipped).

create extension if not exists "pgcrypto";

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
  ('starter', 'Starter', 100, 1024, 1, 10000, 100, '{"staff":2}'::jsonb),
  ('pro', 'Pro', 1000, 10240, 5, 100000, 1000, '{"staff":10}'::jsonb),
  ('enterprise', 'Enterprise', null, null, null, null, null, '{"staff":"unlimited"}'::jsonb)
on conflict (plan_id) do nothing;

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

alter table public.store_settings enable row level security;
alter table public.store_branding enable row level security;
alter table public.store_plan_limits enable row level security;
alter table public.store_subscriptions enable row level security;
alter table public.store_usage_tracking enable row level security;

create or replace function public.can_access_store_instance(candidate_store_instance_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.get_claimed_store_instances_for_current_user() claimed
    where claimed.id = candidate_store_instance_id
  )
  or exists (
    select 1
    from public.store_instances instances
    where instances.id = candidate_store_instance_id
      and (
        instances.owner_user_id = auth.uid()
        or instances.reseller_user_id = auth.uid()
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
    from public.get_claimed_store_instances_for_current_user() claimed
    where claimed.id = candidate_store_instance_id
      and coalesce(claimed.access_role, 'owner') in ('owner', 'admin')
  )
  or exists (
    select 1
    from public.store_instances instances
    where instances.id = candidate_store_instance_id
      and instances.owner_user_id = auth.uid()
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
    'store_usage_tracking'
  ]
  loop
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = managed_table
        and policyname = 'Buyer store members read management records'
    ) then
      execute format(
        'create policy "Buyer store members read management records" on public.%I for select using (public.can_access_store_instance(store_instance_id))',
        managed_table
      );
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = managed_table
        and policyname = 'Buyer store managers write management records'
    ) then
      execute format(
        'create policy "Buyer store managers write management records" on public.%I for all using (public.can_manage_store_instance(store_instance_id)) with check (public.can_manage_store_instance(store_instance_id))',
        managed_table
      );
    end if;
  end loop;

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
end $$;

create or replace function public.assert_store_management_manage_access(candidate_store_instance_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname = 'sync_claimed_store_owner_identity'
  ) then
    perform public.sync_claimed_store_owner_identity(candidate_store_instance_id);
  end if;

  if public.can_manage_store_instance(candidate_store_instance_id) then
    return;
  end if;

  if exists (
    select 1
    from public.get_claimed_store_instances_for_current_user() claimed
    where claimed.id = candidate_store_instance_id
      and coalesce(claimed.access_role, 'owner') in ('owner', 'admin')
  ) then
    return;
  end if;

  raise exception 'not authorized to manage this store';
end;
$$;

create or replace function public.ensure_store_management_defaults(candidate_store_instance_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  instance_row public.store_instances%rowtype;
  settings_slug text;
  period_start date := date_trunc('month', timezone('utc', now()))::date;
  period_end date := (date_trunc('month', timezone('utc', now())) + interval '1 month - 1 day')::date;
begin
  perform public.assert_store_management_manage_access(candidate_store_instance_id);

  select *
    into instance_row
  from public.store_instances
  where id = candidate_store_instance_id;

  if instance_row.id is null then
    raise exception 'store instance not found';
  end if;

  settings_slug := coalesce(nullif(trim(instance_row.internal_slug), ''), 'store')
    || '-'
    || left(replace(instance_row.id::text, '-', ''), 8);

  insert into public.store_settings (
    store_instance_id,
    store_name,
    store_slug,
    store_status
  )
  values (
    instance_row.id,
    coalesce(nullif(trim(instance_row.store_name), ''), 'My Store'),
    settings_slug,
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

  insert into public.store_usage_tracking (
    store_instance_id,
    period_start,
    period_end
  )
  values (
    instance_row.id,
    period_start,
    period_end
  )
  on conflict (store_instance_id, period_start, period_end) do nothing;
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
    'domains', '[]'::jsonb,
    'staff', '[]'::jsonb,
    'roles', '[]'::jsonb,
    'media', '[]'::jsonb,
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

grant execute on function public.can_access_store_instance(uuid) to authenticated;
grant execute on function public.can_manage_store_instance(uuid) to authenticated;
grant execute on function public.assert_store_management_manage_access(uuid) to authenticated;
grant execute on function public.ensure_store_management_defaults(uuid) to authenticated;
grant execute on function public.get_store_management_snapshot(uuid) to authenticated;
