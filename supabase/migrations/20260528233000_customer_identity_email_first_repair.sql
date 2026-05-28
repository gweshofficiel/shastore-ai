-- Customer identity repair: email-first matching.
-- Additive/safe repair: preserves order records and RLS, fixes same-phone/different-email merges.

create extension if not exists "pgcrypto";

-- Same phone can be shared by different customers. Keep email unique, and only keep
-- phone uniqueness for customers that do not have an email identity yet.
drop index if exists customers_store_phone_unique_idx;
drop index if exists store_customers_store_phone_unique_idx;

create unique index if not exists customers_store_phone_no_email_unique_idx
on public.customers(workspace_id, store_id, normalized_phone)
where normalized_phone is not null and normalized_email is null;

create unique index if not exists store_customers_store_phone_no_email_unique_idx
on public.store_customers(workspace_id, store_id, normalized_phone)
where normalized_phone is not null and normalized_email is null;

create unique index if not exists customers_store_email_unique_idx
on public.customers(workspace_id, store_id, normalized_email)
where normalized_email is not null;

create unique index if not exists store_customers_store_email_unique_idx
on public.store_customers(workspace_id, store_id, normalized_email)
where normalized_email is not null;

create or replace function public.upsert_store_customer_from_order(
  candidate_workspace_id uuid,
  candidate_store_id uuid,
  candidate_store_instance_id uuid,
  candidate_order_id uuid,
  candidate_name text,
  candidate_phone text,
  candidate_email text,
  candidate_total numeric,
  candidate_order_status text,
  candidate_created_at timestamptz,
  candidate_order_source text default 'store_orders'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_email text := nullif(lower(trim(coalesce(candidate_email, ''))), '');
  clean_name text := nullif(trim(coalesce(candidate_name, '')), '');
  clean_normalized_phone text := nullif(regexp_replace(coalesce(candidate_phone, ''), '[^0-9+]', '', 'g'), '');
  clean_phone text := nullif(trim(coalesce(candidate_phone, '')), '');
  clean_store_id uuid;
  clean_store_instance_id uuid;
  clean_workspace_id uuid;
  customer_id_value uuid;
  previous_customer_id uuid;
  source_value text := case when candidate_order_source = 'orders' then 'orders' else 'store_orders' end;
begin
  clean_store_id := public.resolve_customer_store_id(candidate_store_id, candidate_store_instance_id);
  clean_workspace_id := public.resolve_customer_workspace_id(candidate_workspace_id, candidate_store_id, candidate_store_instance_id);
  clean_store_instance_id := public.resolve_customer_store_instance_id(clean_store_id, candidate_store_instance_id);

  if clean_store_id is null
    or clean_workspace_id is null
    or candidate_order_id is null
    or (clean_normalized_phone is null and clean_email is null)
  then
    return null;
  end if;

  if clean_email is not null then
    -- Email is the strongest guest identity. Do not merge into an unrelated
    -- customer only because the phone number is shared.
    select customers.id
    into customer_id_value
    from public.customers customers
    where customers.workspace_id = clean_workspace_id
      and customers.store_id = clean_store_id
      and customers.normalized_email = clean_email
    order by customers.updated_at desc
    limit 1;

    -- Safe upgrade path: only attach to a same-phone customer that has no email.
    if customer_id_value is null and clean_normalized_phone is not null then
      select customers.id
      into customer_id_value
      from public.customers customers
      where customers.workspace_id = clean_workspace_id
        and customers.store_id = clean_store_id
        and customers.normalized_phone = clean_normalized_phone
        and customers.normalized_email is null
      order by customers.updated_at desc
      limit 1;
    end if;
  else
    -- No email available: phone is the best available guest identity.
    select customers.id
    into customer_id_value
    from public.customers customers
    where customers.workspace_id = clean_workspace_id
      and customers.store_id = clean_store_id
      and customers.normalized_phone = clean_normalized_phone
    order by
      case when customers.normalized_email is null then 0 else 1 end,
      customers.updated_at desc
    limit 1;
  end if;

  if customer_id_value is null then
    insert into public.customers (
      store_id,
      store_instance_id,
      workspace_id,
      name,
      phone,
      email,
      normalized_phone,
      normalized_email,
      total_orders,
      total_spent,
      first_order_at,
      last_order_at,
      last_order_id,
      metadata
    )
    values (
      clean_store_id,
      clean_store_instance_id,
      clean_workspace_id,
      coalesce(clean_name, 'Customer'),
      clean_phone,
      clean_email,
      clean_normalized_phone,
      clean_email,
      0,
      0,
      null,
      null,
      null,
      jsonb_build_object('source', 'order')
    )
    returning id into customer_id_value;
  else
    update public.customers customers
    set
      name = coalesce(nullif(customers.name, ''), clean_name, 'Customer'),
      phone = coalesce(customers.phone, clean_phone),
      email = case
        when customers.normalized_email is null and clean_email is not null then clean_email
        else customers.email
      end,
      normalized_email = case
        when customers.normalized_email is null and clean_email is not null then clean_email
        else customers.normalized_email
      end,
      store_id = clean_store_id,
      store_instance_id = coalesce(
        public.resolve_customer_store_instance_id(customers.store_id, customers.store_instance_id),
        clean_store_instance_id
      ),
      updated_at = now()
    where customers.id = customer_id_value;
  end if;

  select links.customer_id
  into previous_customer_id
  from public.customer_order_links links
  where links.order_source = source_value
    and links.order_id = candidate_order_id
  limit 1;

  insert into public.customer_order_links (
    customer_id,
    workspace_id,
    store_id,
    order_source,
    order_id,
    order_status,
    order_total,
    order_created_at
  )
  values (
    customer_id_value,
    clean_workspace_id,
    clean_store_id,
    source_value,
    candidate_order_id,
    candidate_order_status,
    coalesce(candidate_total, 0),
    coalesce(candidate_created_at, now())
  )
  on conflict (order_source, order_id)
  do update set
    customer_id = excluded.customer_id,
    workspace_id = excluded.workspace_id,
    store_id = excluded.store_id,
    order_status = excluded.order_status,
    order_total = excluded.order_total,
    order_created_at = excluded.order_created_at,
    updated_at = now();

  perform public.recompute_customer_order_totals(customer_id_value);

  if previous_customer_id is not null and previous_customer_id <> customer_id_value then
    perform public.recompute_customer_order_totals(previous_customer_id);
  end if;

  return customer_id_value;
end;
$$;

grant execute on function public.upsert_store_customer_from_order(uuid, uuid, uuid, uuid, text, text, text, numeric, text, timestamptz, text) to authenticated;

create or replace function public.upsert_store_customer_from_order(
  candidate_workspace_id uuid,
  candidate_store_id uuid,
  candidate_store_instance_id uuid,
  candidate_order_id uuid,
  candidate_name text,
  candidate_phone text,
  candidate_email text,
  candidate_total numeric,
  candidate_order_status text,
  candidate_created_at timestamptz
)
returns uuid
language sql
security definer
set search_path = public
as $$
  select public.upsert_store_customer_from_order(
    candidate_workspace_id,
    candidate_store_id,
    candidate_store_instance_id,
    candidate_order_id,
    candidate_name,
    candidate_phone,
    candidate_email,
    candidate_total,
    candidate_order_status,
    candidate_created_at,
    'store_orders'
  );
$$;

grant execute on function public.upsert_store_customer_from_order(uuid, uuid, uuid, uuid, text, text, text, numeric, text, timestamptz) to authenticated;

-- Re-run customer linking for existing orders using the corrected identity rules.
do $$
declare
  order_row record;
begin
  if to_regclass('public.store_orders') is not null then
    for order_row in
      select id, workspace_id, store_id, store_instance_id, customer_name, customer_phone, customer_email, total, order_status, created_at
      from public.store_orders
      where customer_phone is not null or customer_email is not null
      order by created_at asc
    loop
      begin
        perform public.upsert_store_customer_from_order(
          order_row.workspace_id,
          order_row.store_id,
          order_row.store_instance_id,
          order_row.id,
          order_row.customer_name,
          order_row.customer_phone,
          order_row.customer_email,
          order_row.total,
          order_row.order_status,
          order_row.created_at,
          'store_orders'
        );
      exception
        when others then
          raise warning 'store_orders email-first customer resync skipped for order %: %', order_row.id, sqlerrm;
      end;
    end loop;
  end if;

  if to_regclass('public.orders') is not null then
    for order_row in
      select id, workspace_id, store_id, store_instance_id, customer_name, customer_phone, customer_email, total, order_status, created_at
      from public.orders
      where customer_phone is not null or customer_email is not null
      order by created_at asc
    loop
      begin
        perform public.upsert_store_customer_from_order(
          order_row.workspace_id,
          order_row.store_id,
          order_row.store_instance_id,
          order_row.id,
          order_row.customer_name,
          order_row.customer_phone,
          order_row.customer_email,
          order_row.total,
          order_row.order_status,
          order_row.created_at,
          'orders'
        );
      exception
        when others then
          raise warning 'orders email-first customer resync skipped for order %: %', order_row.id, sqlerrm;
      end;
    end loop;
  end if;
end $$;
