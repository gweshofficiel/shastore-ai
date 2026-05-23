-- Unified checkout and public-safe order capture for SHASTORE AI.
-- Additive and idempotent: extends commerce tables without changing publish/template architecture.

alter table if exists public.commerce_customers
  add column if not exists source text,
  add column if not exists order_count integer not null default 0,
  add column if not exists total_spent numeric(12,2) not null default 0;

alter table if exists public.commerce_orders
  add column if not exists customer_name text,
  add column if not exists customer_phone text,
  add column if not exists customer_email text,
  add column if not exists city text,
  add column if not exists address text,
  add column if not exists subtotal numeric(12,2) not null default 0,
  add column if not exists total numeric(12,2) not null default 0;

create index if not exists commerce_customers_phone_idx on public.commerce_customers(user_id, phone);
create index if not exists commerce_customers_email_idx on public.commerce_customers(user_id, email);
create index if not exists commerce_orders_customer_phone_idx on public.commerce_orders(user_id, customer_phone);

do $$
declare
  constraint_row record;
begin
  if to_regclass('public.commerce_analytics_events') is not null then
    for constraint_row in
      select conname
      from pg_constraint
      where conrelid = 'public.commerce_analytics_events'::regclass
        and contype = 'c'
        and pg_get_constraintdef(oid) like '%event_type%'
    loop
      execute format(
        'alter table public.commerce_analytics_events drop constraint if exists %I',
        constraint_row.conname
      );
    end loop;

    alter table public.commerce_analytics_events
      add constraint commerce_analytics_events_event_type_check
      check (
        event_type in (
          'visitor',
          'page_view',
          'whatsapp_click',
          'checkout_started',
          'order_created',
          'conversion',
          'order'
        )
      );
  end if;
end $$;

create or replace function public.track_commerce_event(
  p_source_type text,
  p_source_slug text,
  p_event_type text,
  p_visitor_id text default null,
  p_session_id text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_user_id uuid;
  resolved_source_id uuid;
  inserted_id uuid;
begin
  if p_source_type = 'landing' then
    select user_id, id
      into resolved_user_id, resolved_source_id
      from public.landing_pages
      where slug = p_source_slug
        and status = 'published'
      limit 1;
  elsif p_source_type = 'store' then
    select user_id, store_id
      into resolved_user_id, resolved_source_id
      from public.published_stores
      where slug = p_source_slug
        and status = 'published'
        and coalesce(visibility, 'public') = 'public'
      limit 1;
  else
    raise exception 'Invalid commerce source type';
  end if;

  if resolved_user_id is null then
    raise exception 'Published commerce source not found';
  end if;

  insert into public.commerce_analytics_events (
    user_id,
    source_type,
    source_id,
    source_slug,
    event_type,
    visitor_id,
    session_id,
    metadata
  )
  values (
    resolved_user_id,
    p_source_type,
    resolved_source_id,
    p_source_slug,
    p_event_type,
    p_visitor_id,
    p_session_id,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into inserted_id;

  return inserted_id;
end;
$$;

create or replace function public.create_commerce_order(
  p_source_type text,
  p_source_slug text,
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text default null,
  p_city text default null,
  p_address text default null,
  p_notes text default null,
  p_payment_method text default 'whatsapp',
  p_products jsonb default '[]'::jsonb,
  p_subtotal numeric default 0,
  p_total numeric default 0,
  p_currency text default 'USD',
  p_visitor_id text default null,
  p_session_id text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_user_id uuid;
  resolved_source_id uuid;
  customer_id_value uuid;
  order_id_value uuid;
  clean_name text := nullif(trim(coalesce(p_customer_name, '')), '');
  clean_phone text := nullif(trim(coalesce(p_customer_phone, '')), '');
  clean_email text := nullif(trim(coalesce(p_customer_email, '')), '');
  clean_city text := nullif(trim(coalesce(p_city, '')), '');
  clean_address text := nullif(trim(coalesce(p_address, '')), '');
  clean_notes text := nullif(trim(coalesce(p_notes, '')), '');
  clean_payment text := coalesce(nullif(trim(p_payment_method), ''), 'whatsapp');
  clean_currency text := upper(coalesce(nullif(trim(p_currency), ''), 'USD'));
  safe_products jsonb := coalesce(p_products, '[]'::jsonb);
  safe_subtotal numeric := greatest(coalesce(p_subtotal, 0), 0);
  safe_total numeric := greatest(coalesce(p_total, p_subtotal, 0), 0);
  item jsonb;
begin
  if clean_name is null or clean_phone is null then
    raise exception 'Customer name and phone are required';
  end if;

  if clean_payment not in ('cod', 'whatsapp', 'stripe', 'paypal') then
    raise exception 'Invalid payment method';
  end if;

  if jsonb_typeof(safe_products) <> 'array' then
    safe_products := '[]'::jsonb;
  end if;

  if p_source_type = 'landing' then
    select user_id, id
      into resolved_user_id, resolved_source_id
      from public.landing_pages
      where slug = p_source_slug
        and status = 'published'
      limit 1;
  elsif p_source_type = 'store' then
    select user_id, store_id
      into resolved_user_id, resolved_source_id
      from public.published_stores
      where slug = p_source_slug
        and status = 'published'
        and coalesce(visibility, 'public') = 'public'
      limit 1;
  else
    raise exception 'Invalid commerce source type';
  end if;

  if resolved_user_id is null then
    raise exception 'Published commerce source not found';
  end if;

  select id
    into customer_id_value
    from public.commerce_customers
    where user_id = resolved_user_id
      and (
        (clean_phone is not null and phone = clean_phone)
        or (clean_email is not null and email = clean_email)
      )
    order by updated_at desc
    limit 1;

  if customer_id_value is null then
    insert into public.commerce_customers (
      user_id,
      source_type,
      source_id,
      source,
      name,
      email,
      phone,
      city,
      notes
    )
    values (
      resolved_user_id,
      p_source_type,
      resolved_source_id,
      p_source_slug,
      clean_name,
      clean_email,
      clean_phone,
      clean_city,
      clean_notes
    )
    returning id into customer_id_value;
  else
    update public.commerce_customers
      set
        name = clean_name,
        email = coalesce(clean_email, email),
        phone = coalesce(clean_phone, phone),
        city = coalesce(clean_city, city),
        source_type = p_source_type,
        source_id = resolved_source_id,
        source = p_source_slug,
        notes = coalesce(clean_notes, notes),
        updated_at = now()
      where id = customer_id_value;
  end if;

  insert into public.commerce_orders (
    user_id,
    customer_id,
    source_type,
    source_id,
    source_slug,
    status,
    payment_method,
    payment_status,
    customer_name,
    customer_phone,
    customer_email,
    city,
    address,
    notes,
    customer_snapshot,
    products,
    currency,
    subtotal,
    total,
    total_amount
  )
  values (
    resolved_user_id,
    customer_id_value,
    p_source_type,
    resolved_source_id,
    p_source_slug,
    'new',
    clean_payment,
    case when clean_payment in ('stripe', 'paypal') then 'pending' else 'pending' end,
    clean_name,
    clean_phone,
    clean_email,
    clean_city,
    clean_address,
    clean_notes,
    jsonb_build_object(
      'name', clean_name,
      'phone', clean_phone,
      'email', clean_email,
      'city', clean_city,
      'address', clean_address
    ),
    safe_products,
    clean_currency,
    safe_subtotal,
    safe_total,
    safe_total
  )
  returning id into order_id_value;

  for item in select * from jsonb_array_elements(safe_products)
  loop
    insert into public.commerce_order_items (
      order_id,
      user_id,
      product_id,
      product_name,
      quantity,
      unit_price,
      total_price,
      metadata
    )
    values (
      order_id_value,
      resolved_user_id,
      item->>'id',
      coalesce(nullif(item->>'name', ''), 'Product'),
      greatest(coalesce((item->>'quantity')::integer, 1), 1),
      greatest(coalesce((item->>'unitPrice')::numeric, 0), 0),
      greatest(coalesce((item->>'totalPrice')::numeric, 0), 0),
      item
    );
  end loop;

  update public.commerce_customers
    set
      order_count = order_count + 1,
      total_spent = total_spent + safe_total,
      updated_at = now()
    where id = customer_id_value;

  perform public.track_commerce_event(
    p_source_type,
    p_source_slug,
    'order_created',
    p_visitor_id,
    p_session_id,
    jsonb_build_object('order_id', order_id_value, 'payment_method', clean_payment, 'total', safe_total)
  );

  perform public.track_commerce_event(
    p_source_type,
    p_source_slug,
    'conversion',
    p_visitor_id,
    p_session_id,
    jsonb_build_object('order_id', order_id_value, 'total', safe_total)
  );

  return order_id_value;
end;
$$;

grant execute on function public.track_commerce_event(text, text, text, text, text, jsonb) to anon, authenticated;
grant execute on function public.create_commerce_order(text, text, text, text, text, text, text, text, text, jsonb, numeric, numeric, text, text, text) to anon, authenticated;

