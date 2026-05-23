-- Buyer checkout foundation for seller-owned payment methods only.
-- This does not touch SHASTORE AI platform billing or platform Stripe checkout.

alter table if exists public.commerce_orders
  add column if not exists checkout_source text,
  add column if not exists buyer_notes text;

do $$
declare
  constraint_row record;
begin
  if to_regclass('public.commerce_orders') is not null then
    for constraint_row in
      select conname
      from pg_constraint
      join pg_attribute
        on pg_attribute.attrelid = pg_constraint.conrelid
       and pg_attribute.attnum = any(pg_constraint.conkey)
      where pg_constraint.conrelid = 'public.commerce_orders'::regclass
        and pg_constraint.contype = 'c'
        and pg_attribute.attname = 'status'
    loop
      execute format(
        'alter table public.commerce_orders drop constraint if exists %I',
        constraint_row.conname
      );
    end loop;

    alter table public.commerce_orders
      add constraint commerce_orders_status_check
      check (status in ('pending', 'new', 'confirmed', 'shipped', 'delivered', 'canceled'));
  end if;
end $$;

create or replace function public.get_public_checkout_settings(
  p_source_type text,
  p_source_slug text
)
returns table (
  cod_enabled boolean,
  whatsapp_orders_enabled boolean,
  default_whatsapp_number text,
  stripe_seller_enabled boolean,
  paypal_seller_enabled boolean,
  crypto_enabled boolean,
  payment_instructions text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_user_id uuid;
begin
  if p_source_type = 'landing' then
    select user_id
      into resolved_user_id
      from public.landing_pages
      where slug = p_source_slug
        and status = 'published'
      limit 1;
  elsif p_source_type = 'store' then
    select ps.user_id
      into resolved_user_id
      from public.published_stores ps
      where ps.slug = p_source_slug
        and ps.status = 'published'
        and coalesce(ps.visibility, 'public') = 'public'
      limit 1;
  else
    raise exception 'Invalid checkout source type';
  end if;

  if resolved_user_id is null then
    raise exception 'Published checkout source not found';
  end if;

  return query
  select
    coalesce(cps.cod_enabled, true),
    coalesce(cps.whatsapp_orders_enabled, true),
    cps.default_whatsapp_number,
    coalesce(cps.stripe_seller_enabled, false),
    coalesce(cps.paypal_seller_enabled, false),
    coalesce(cps.crypto_enabled, false),
    cps.payment_instructions
  from (select resolved_user_id as user_id) owner
  left join public.commerce_payment_settings cps on cps.user_id = owner.user_id;
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
  settings_row record;
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

  if clean_payment not in ('cod', 'whatsapp') then
    raise exception 'Online payment checkout is not enabled yet';
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

  select *
    into settings_row
    from public.get_public_checkout_settings(p_source_type, p_source_slug)
    limit 1;

  if clean_payment = 'cod' and not coalesce(settings_row.cod_enabled, true) then
    raise exception 'Cash on Delivery is not enabled for this seller';
  end if;

  if clean_payment = 'whatsapp' and not coalesce(settings_row.whatsapp_orders_enabled, true) then
    raise exception 'WhatsApp Orders are not enabled for this seller';
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
    checkout_source,
    buyer_notes,
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
    'pending',
    clean_payment,
    'pending',
    clean_name,
    clean_phone,
    clean_email,
    clean_city,
    clean_address,
    clean_notes,
    'buyer_checkout',
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

grant execute on function public.get_public_checkout_settings(text, text) to anon, authenticated;
grant execute on function public.create_commerce_order(text, text, text, text, text, text, text, text, text, jsonb, numeric, numeric, text, text, text) to anon, authenticated;

