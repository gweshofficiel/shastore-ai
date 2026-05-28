-- Customer segmentation and loyalty foundation.
-- Additive only: derives segment/tier/points from existing store customer aggregates.

alter table public.store_customers
  add column if not exists segment text not null default 'new',
  add column if not exists loyalty_points integer not null default 0,
  add column if not exists loyalty_tier text not null default 'bronze',
  add column if not exists last_segment_calculated_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'store_customers_segment_check'
      and conrelid = 'public.store_customers'::regclass
  ) then
    alter table public.store_customers
      add constraint store_customers_segment_check
      check (segment in ('new', 'returning', 'vip', 'at_risk', 'high_spender'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'store_customers_loyalty_tier_check'
      and conrelid = 'public.store_customers'::regclass
  ) then
    alter table public.store_customers
      add constraint store_customers_loyalty_tier_check
      check (loyalty_tier in ('bronze', 'silver', 'gold', 'platinum'));
  end if;
end $$;

create index if not exists store_customers_segment_idx
on public.store_customers(workspace_id, store_id, segment, updated_at desc);

create index if not exists store_customers_loyalty_tier_idx
on public.store_customers(workspace_id, store_id, loyalty_tier, updated_at desc);

create or replace function public.calculate_store_customer_segment(
  candidate_total_orders integer,
  candidate_total_spent numeric,
  candidate_first_order_at timestamptz,
  candidate_last_order_at timestamptz
)
returns text
language sql
stable
as $$
  select case
    when coalesce(candidate_total_spent, 0) >= 1000
      or coalesce(candidate_total_orders, 0) >= 10 then 'vip'
    when candidate_last_order_at is not null
      and candidate_last_order_at < now() - interval '90 days'
      and coalesce(candidate_total_orders, 0) > 0 then 'at_risk'
    when coalesce(candidate_total_spent, 0) >= 500 then 'high_spender'
    when coalesce(candidate_total_orders, 0) >= 2 then 'returning'
    else 'new'
  end
$$;

create or replace function public.calculate_store_customer_loyalty_points(
  candidate_total_spent numeric
)
returns integer
language sql
immutable
as $$
  select greatest(0, floor(coalesce(candidate_total_spent, 0)))::integer
$$;

create or replace function public.calculate_store_customer_loyalty_tier(
  candidate_loyalty_points integer
)
returns text
language sql
immutable
as $$
  select case
    when coalesce(candidate_loyalty_points, 0) >= 2000 then 'platinum'
    when coalesce(candidate_loyalty_points, 0) >= 1000 then 'gold'
    when coalesce(candidate_loyalty_points, 0) >= 500 then 'silver'
    else 'bronze'
  end
$$;

create or replace function public.set_store_customers_updated_at()
returns trigger
language plpgsql
as $$
declare
  calculated_points integer;
begin
  calculated_points := public.calculate_store_customer_loyalty_points(new.total_spent);
  new.updated_at = now();
  new.normalized_phone = nullif(regexp_replace(coalesce(new.phone, ''), '[^0-9+]', '', 'g'), '');
  new.normalized_email = nullif(lower(trim(coalesce(new.email, ''))), '');
  new.tags = coalesce(new.tags, '{}'::text[]);
  new.status = case
    when new.status in ('new', 'active', 'returning', 'vip') then new.status
    else public.derive_store_customer_status(new.total_orders, new.total_spent)
  end;
  new.segment = public.calculate_store_customer_segment(
    new.total_orders,
    new.total_spent,
    new.first_order_at,
    new.last_order_at
  );
  new.loyalty_points = calculated_points;
  new.loyalty_tier = public.calculate_store_customer_loyalty_tier(calculated_points);
  new.last_segment_calculated_at = now();
  return new;
end;
$$;

update public.store_customers customers
set
  segment = public.calculate_store_customer_segment(
    customers.total_orders,
    customers.total_spent,
    customers.first_order_at,
    customers.last_order_at
  ),
  loyalty_points = public.calculate_store_customer_loyalty_points(customers.total_spent),
  loyalty_tier = public.calculate_store_customer_loyalty_tier(
    public.calculate_store_customer_loyalty_points(customers.total_spent)
  ),
  last_segment_calculated_at = now(),
  updated_at = now();

create or replace function public.sync_store_customer_profile_from_customer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  calculated_segment text;
  calculated_points integer;
  calculated_tier text;
begin
  if new.workspace_id is null or new.store_id is null then
    return new;
  end if;

  calculated_segment := public.calculate_store_customer_segment(
    new.total_orders,
    new.total_spent,
    new.first_order_at,
    new.last_order_at
  );
  calculated_points := public.calculate_store_customer_loyalty_points(new.total_spent);
  calculated_tier := public.calculate_store_customer_loyalty_tier(calculated_points);

  insert into public.store_customers (
    id,
    workspace_id,
    store_id,
    name,
    email,
    phone,
    normalized_email,
    normalized_phone,
    status,
    segment,
    loyalty_points,
    loyalty_tier,
    last_segment_calculated_at,
    total_orders,
    total_spent,
    first_order_at,
    last_order_at,
    last_order_id,
    metadata,
    created_at,
    updated_at
  )
  values (
    new.id,
    new.workspace_id,
    new.store_id,
    coalesce(nullif(new.name, ''), 'Customer'),
    new.email,
    new.phone,
    new.normalized_email,
    new.normalized_phone,
    public.derive_store_customer_status(new.total_orders, new.total_spent),
    calculated_segment,
    calculated_points,
    calculated_tier,
    now(),
    coalesce(new.total_orders, 0),
    coalesce(new.total_spent, 0),
    new.first_order_at,
    new.last_order_at,
    new.last_order_id,
    coalesce(new.metadata, '{}'::jsonb) || jsonb_build_object('legacyCustomerId', new.id),
    coalesce(new.created_at, now()),
    coalesce(new.updated_at, now())
  )
  on conflict (id) do update
  set
    workspace_id = excluded.workspace_id,
    store_id = excluded.store_id,
    name = excluded.name,
    email = excluded.email,
    phone = excluded.phone,
    normalized_email = excluded.normalized_email,
    normalized_phone = excluded.normalized_phone,
    status = case
      when public.store_customers.status in ('vip', 'active') then public.store_customers.status
      else excluded.status
    end,
    segment = excluded.segment,
    loyalty_points = excluded.loyalty_points,
    loyalty_tier = excluded.loyalty_tier,
    last_segment_calculated_at = now(),
    total_orders = excluded.total_orders,
    total_spent = excluded.total_spent,
    first_order_at = excluded.first_order_at,
    last_order_at = excluded.last_order_at,
    last_order_id = excluded.last_order_id,
    metadata = coalesce(public.store_customers.metadata, '{}'::jsonb) || excluded.metadata,
    updated_at = now();

  return new;
end;
$$;

-- Recalculate segments after replacing the sync function so existing customers are current.
update public.customers
set updated_at = now()
where workspace_id is not null
  and store_id is not null;
