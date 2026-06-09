-- PHASE C4: C3 Test Store commerce simulation seed.
--
-- Idempotent seed for the canonical test store only:
--   stores.slug = 'c3-test-store'
--
-- Notes:
-- - This migration does not reset data, remove RLS, or touch Stripe/PayPal provider tables.
-- - Optional feature tables are guarded with to_regclass checks. If a table is not present in
--   an environment, that section is skipped instead of creating a parallel schema.
-- - The existing store_products table has no product-level SKU column; SKUs are stored in
--   product_variants.sku per the current product variants foundation.

create extension if not exists "pgcrypto";

-- Store payment methods originally constrained method to cod/whatsapp/paypal/youcan_pay.
-- C4 adds offline method codes for the C3 store only: cash_on_delivery, bank_transfer,
-- and whatsapp_order. Stripe/PayPal integrations are not modified.
do $$
declare
  constraint_record record;
begin
  if to_regclass('public.store_payment_methods') is not null then
    for constraint_record in
      select conname
      from pg_constraint
      where conrelid = 'public.store_payment_methods'::regclass
        and contype = 'c'
        and pg_get_constraintdef(oid) ilike '%method%'
    loop
      execute format('alter table public.store_payment_methods drop constraint if exists %I', constraint_record.conname);
    end loop;

    if not exists (
      select 1
      from pg_constraint
      where conname = 'store_payment_methods_method_check'
        and conrelid = 'public.store_payment_methods'::regclass
    ) then
      alter table public.store_payment_methods
        add constraint store_payment_methods_method_check
        check (method in (
          'cod',
          'cash_on_delivery',
          'bank_transfer',
          'whatsapp',
          'whatsapp_order',
          'paypal',
          'youcan_pay'
        ));
    end if;
  end if;
end $$;

do $$
declare
  store_record record;
  owner_id uuid;
  customer_id uuid;
  delivery_user_id uuid;
  hoodie_product_id uuid;
  guide_product_id uuid;
  shipping_profile_id uuid;
  shipping_zone_id uuid;
  store_customer_id uuid;
  delivery_agent_id uuid;
  color_name text;
  size_name text;
  variant_sku text;
begin
  select *
  into store_record
  from public.stores
  where slug = 'c3-test-store'
  limit 1;

  if store_record.id is null then
    -- C3 store is required for this seed. Do not create a random replacement store.
    return;
  end if;

  select id into owner_id from auth.users where lower(email) = 'owner.test@shastore.test' limit 1;
  select id into customer_id from auth.users where lower(email) = 'customer.test@shastore.test' limit 1;
  select id into delivery_user_id from auth.users where lower(email) = 'delivery.test@shastore.test' limit 1;

  if owner_id is null then
    raise exception 'owner.test auth user not found';
  end if;

  update public.stores
  set
    status = 'published',
    is_active = true,
    delivery_enabled = true,
    pickup_enabled = true,
    delivery_fee = coalesce(delivery_fee, 5.00),
    support_phone = coalesce(nullif(trim(support_phone), ''), '+15551234567'),
    whatsapp_number = coalesce(nullif(trim(whatsapp_number), ''), '+15551234567'),
    updated_at = now()
  where id = store_record.id
  returning * into store_record;

  if to_regclass('public.published_stores') is not null then
    insert into public.published_stores (
      store_id,
      user_id,
      workspace_id,
      slug,
      url,
      status,
      visibility,
      published_at,
      updated_at
    )
    values (
      store_record.id,
      coalesce(store_record.owner_user_id, store_record.user_id),
      store_record.workspace_id,
      'c3-test-store',
      '/store/c3-test-store',
      'published',
      'public',
      now(),
      now()
    )
    on conflict (store_id) do update
    set
      user_id = excluded.user_id,
      workspace_id = excluded.workspace_id,
      slug = excluded.slug,
      url = excluded.url,
      status = 'published',
      visibility = 'public',
      published_at = coalesce(public.published_stores.published_at, now()),
      updated_at = now();
  end if;

  if to_regclass('public.store_products') is not null then
    insert into public.store_products (
      workspace_id,
      store_id,
      user_id,
      owner_user_id,
      name,
      title,
      slug,
      description,
      price,
      compare_at_price,
      currency,
      product_type,
      requires_shipping,
      digital_delivery_enabled,
      status,
      stock_quantity,
      track_inventory,
      inventory_status,
      sort_order,
      updated_at
    )
    values (
      store_record.workspace_id,
      store_record.id,
      store_record.user_id,
      coalesce(store_record.owner_user_id, store_record.user_id),
      'C3 Premium Hoodie',
      'C3 Premium Hoodie',
      'c3-premium-hoodie',
      'Premium hoodie used for testing inventory, shipping, delivery and order lifecycle.',
      '49.99',
      69.99,
      'USD',
      'physical',
      true,
      false,
      'active',
      25,
      true,
      'in_stock',
      10,
      now()
    )
    on conflict (store_id, slug) do update
    set
      workspace_id = excluded.workspace_id,
      user_id = excluded.user_id,
      owner_user_id = excluded.owner_user_id,
      name = excluded.name,
      title = excluded.title,
      description = excluded.description,
      price = excluded.price,
      compare_at_price = excluded.compare_at_price,
      currency = excluded.currency,
      product_type = excluded.product_type,
      requires_shipping = excluded.requires_shipping,
      digital_delivery_enabled = excluded.digital_delivery_enabled,
      status = excluded.status,
      stock_quantity = excluded.stock_quantity,
      track_inventory = excluded.track_inventory,
      inventory_status = excluded.inventory_status,
      sort_order = excluded.sort_order,
      updated_at = now()
    returning id into hoodie_product_id;

    insert into public.store_products (
      workspace_id,
      store_id,
      user_id,
      owner_user_id,
      name,
      title,
      slug,
      description,
      price,
      compare_at_price,
      currency,
      product_type,
      requires_shipping,
      digital_delivery_enabled,
      digital_file_name,
      digital_file_path,
      digital_file_bucket,
      digital_file_type,
      digital_file_size,
      status,
      stock_quantity,
      track_inventory,
      inventory_status,
      sort_order,
      updated_at
    )
    values (
      store_record.workspace_id,
      store_record.id,
      store_record.user_id,
      coalesce(store_record.owner_user_id, store_record.user_id),
      'C3 Digital Launch Guide',
      'C3 Digital Launch Guide',
      'c3-digital-launch-guide',
      'Digital downloadable guide used to test customer account downloads and digital fulfillment.',
      '19.99',
      null,
      'USD',
      'digital',
      false,
      true,
      'c3-digital-launch-guide.pdf',
      'c3/c3-digital-launch-guide.pdf',
      'store-downloads',
      'application/pdf',
      1024000,
      'active',
      0,
      false,
      'in_stock',
      20,
      now()
    )
    on conflict (store_id, slug) do update
    set
      workspace_id = excluded.workspace_id,
      user_id = excluded.user_id,
      owner_user_id = excluded.owner_user_id,
      name = excluded.name,
      title = excluded.title,
      description = excluded.description,
      price = excluded.price,
      compare_at_price = excluded.compare_at_price,
      currency = excluded.currency,
      product_type = excluded.product_type,
      requires_shipping = excluded.requires_shipping,
      digital_delivery_enabled = excluded.digital_delivery_enabled,
      digital_file_name = excluded.digital_file_name,
      digital_file_path = excluded.digital_file_path,
      digital_file_bucket = excluded.digital_file_bucket,
      digital_file_type = excluded.digital_file_type,
      digital_file_size = excluded.digital_file_size,
      status = excluded.status,
      stock_quantity = excluded.stock_quantity,
      track_inventory = excluded.track_inventory,
      inventory_status = excluded.inventory_status,
      sort_order = excluded.sort_order,
      updated_at = now()
    returning id into guide_product_id;
  end if;

  if to_regclass('public.product_variants') is not null and hoodie_product_id is not null then
    foreach color_name in array array['Black', 'White', 'Navy']
    loop
      foreach size_name in array array['S', 'M', 'L', 'XL']
      loop
        variant_sku := 'C3-HOODIE-001-' || upper(left(color_name, 1)) || '-' || size_name;

        update public.product_variants
        set
          workspace_id = store_record.workspace_id,
          store_id = store_record.id,
          name = color_name || ' / ' || size_name,
          option_color = color_name,
          option_size = size_name,
          stock_quantity = 25,
          status = 'active',
          updated_at = now()
        where product_id = hoodie_product_id
          and lower(sku) = lower(variant_sku);

        insert into public.product_variants (
          workspace_id,
          store_id,
          product_id,
          name,
          option_color,
          option_size,
          sku,
          stock_quantity,
          status,
          updated_at
        )
        select
          store_record.workspace_id,
          store_record.id,
          hoodie_product_id,
          color_name || ' / ' || size_name,
          color_name,
          size_name,
          variant_sku,
          25,
          'active',
          now()
        
        where not exists (
          select 1
          from public.product_variants existing
          where existing.product_id = hoodie_product_id
            and lower(existing.sku) = lower(variant_sku)
        );
      end loop;
    end loop;

    if guide_product_id is not null then
      update public.product_variants
      set
        workspace_id = store_record.workspace_id,
        store_id = store_record.id,
        name = 'Digital Download',
        option_custom_name = 'Format',
        option_custom_value = 'PDF',
        stock_quantity = 0,
        status = 'active',
        updated_at = now()
      where product_id = guide_product_id
        and lower(sku) = lower('C3-DIGITAL-001');

      insert into public.product_variants (
        workspace_id,
        store_id,
        product_id,
        name,
        option_custom_name,
        option_custom_value,
        sku,
        stock_quantity,
        status,
        updated_at
      )
      select
        store_record.workspace_id,
        store_record.id,
        guide_product_id,
        'Digital Download',
        'Format',
        'PDF',
        'C3-DIGITAL-001',
        0,
        'active',
        now()
      
      where not exists (
        select 1
        from public.product_variants existing
        where existing.product_id = guide_product_id
          and lower(existing.sku) = lower('C3-DIGITAL-001')
      );
    end if;
  end if;

  if to_regclass('public.store_payment_methods') is not null then
    insert into public.store_payment_methods (
      workspace_id,
      store_id,
      method,
      is_enabled,
      display_name,
      instructions,
      config,
      updated_at
    )
    values
      (
        store_record.workspace_id,
        store_record.id,
        'cash_on_delivery',
        true,
        'Cash On Delivery',
        'Pay the delivery agent when receiving the order.',
        jsonb_build_object('code', 'cash_on_delivery', 'title', 'Cash On Delivery'),
        now()
      ),
      (
        store_record.workspace_id,
        store_record.id,
        'bank_transfer',
        true,
        'Bank Transfer',
        'Send transfer and upload proof of payment.',
        jsonb_build_object(
          'code', 'bank_transfer',
          'title', 'Bank Transfer',
          'bankName', 'SHASTORE TEST BANK',
          'accountName', 'C3 Test Store',
          'iban', 'TEST-IBAN-123456789',
          'swift', 'TESTSWIFT01',
          'reference', 'Use Order Number as payment reference.'
        ),
        now()
      ),
      (
        store_record.workspace_id,
        store_record.id,
        'whatsapp_order',
        true,
        'Order via WhatsApp',
        'Customer submits order and completes payment manually through merchant.',
        jsonb_build_object('code', 'whatsapp_order', 'title', 'Order via WhatsApp', 'whatsapp', '+15551234567'),
        now()
      )
    on conflict (store_id, method) do update
    set
      workspace_id = excluded.workspace_id,
      is_enabled = true,
      display_name = excluded.display_name,
      instructions = excluded.instructions,
      config = excluded.config,
      updated_at = now();
  end if;

  if to_regclass('public.shipping_profiles') is not null then
    select id into shipping_profile_id
    from public.shipping_profiles
    where store_id = store_record.id
      and lower(name) = 'standard shipping'
    limit 1;

    if shipping_profile_id is null then
      insert into public.shipping_profiles (
        workspace_id,
        store_id,
        name,
        status,
        is_default,
        sort_order,
        updated_at
      )
      values (
        store_record.workspace_id,
        store_record.id,
        'Standard Shipping',
        'active',
        not exists (
          select 1
          from public.shipping_profiles existing
          where existing.store_id = store_record.id
            and existing.is_default = true
        ),
        10,
        now()
      )
      returning id into shipping_profile_id;
    else
      update public.shipping_profiles
      set
        workspace_id = store_record.workspace_id,
        status = 'active',
        sort_order = 10,
        updated_at = now()
      where id = shipping_profile_id;
    end if;
  end if;

  if to_regclass('public.shipping_zones') is not null and shipping_profile_id is not null then
    select id into shipping_zone_id
    from public.shipping_zones
    where store_id = store_record.id
      and profile_id = shipping_profile_id
      and country = 'US'
      and coalesce(region, '') = ''
      and coalesce(city, '') = ''
    limit 1;

    if shipping_zone_id is null then
      insert into public.shipping_zones (
        workspace_id,
        store_id,
        profile_id,
        country,
        region,
        city,
        status,
        sort_order,
        updated_at
      )
      values (
        store_record.workspace_id,
        store_record.id,
        shipping_profile_id,
        'US',
        null,
        null,
        'active',
        10,
        now()
      )
      returning id into shipping_zone_id;
    else
      update public.shipping_zones
      set
        workspace_id = store_record.workspace_id,
        status = 'active',
        sort_order = 10,
        updated_at = now()
      where id = shipping_zone_id;
    end if;
  end if;

  if to_regclass('public.shipping_methods') is not null and shipping_profile_id is not null then
    if exists (
      select 1
      from public.shipping_methods
      where store_id = store_record.id
        and profile_id = shipping_profile_id
        and lower(coalesce(name, method_name, '')) = 'standard shipping'
    ) then
      update public.shipping_methods
      set
        user_id = owner_id,
        workspace_id = store_record.workspace_id,
        zone_id = coalesce(zone_id, shipping_zone_id),
        name = 'Standard Shipping',
        method_name = 'Standard Shipping',
        method_type = 'standard',
        status = 'active',
        enabled = true,
        fixed_fee = 5.00,
        flat_fee = 5.00,
        free_shipping_threshold = null,
        processing_time_days = 1,
        estimated_min_days = 3,
        estimated_max_days = 5,
        estimated_delivery_days = 5,
        sort_order = 10,
        updated_at = now()
      where store_id = store_record.id
        and profile_id = shipping_profile_id
        and lower(coalesce(name, method_name, '')) = 'standard shipping';
    else
      insert into public.shipping_methods (
        user_id,
        workspace_id,
        store_id,
        profile_id,
        zone_id,
        name,
        method_name,
        method_type,
        status,
        enabled,
        fixed_fee,
        flat_fee,
        free_shipping_threshold,
        processing_time_days,
        estimated_min_days,
        estimated_max_days,
        estimated_delivery_days,
        sort_order,
        updated_at
      )
      values (
        owner_id,
        store_record.workspace_id,
        store_record.id,
        shipping_profile_id,
        shipping_zone_id,
        'Standard Shipping',
        'Standard Shipping',
        'standard',
        'active',
        true,
        5.00,
        5.00,
        null,
        1,
        3,
        5,
        5,
        10,
        now()
      );
    end if;
  end if;

  if to_regclass('public.shipping_rates') is not null and shipping_profile_id is not null and shipping_zone_id is not null then
    if exists (
      select 1
      from public.shipping_rates
      where store_id = store_record.id
        and profile_id = shipping_profile_id
        and zone_id = shipping_zone_id
        and lower(rate_name) = 'standard shipping'
    ) then
      update public.shipping_rates
      set
        workspace_id = store_record.workspace_id,
        rate_type = 'flat_rate',
        price = 5.00,
        currency = 'USD',
        enabled = true,
        status = 'active',
        sort_order = 10,
        updated_at = now()
      where store_id = store_record.id
        and profile_id = shipping_profile_id
        and zone_id = shipping_zone_id
        and lower(rate_name) = 'standard shipping';
    else
      insert into public.shipping_rates (
        workspace_id,
        store_id,
        profile_id,
        zone_id,
        rate_name,
        rate_type,
        price,
        currency,
        enabled,
        status,
        sort_order,
        updated_at
      )
      values (
        store_record.workspace_id,
        store_record.id,
        shipping_profile_id,
        shipping_zone_id,
        'Standard Shipping',
        'flat_rate',
        5.00,
        'USD',
        true,
        'active',
        10,
        now()
      );
    end if;
  end if;

  if to_regclass('public.store_customers') is not null then
    update public.store_customers
    set
      workspace_id = store_record.workspace_id,
      store_id = store_record.id,
      name = 'Customer Test',
      email = 'customer.test@shastore.test',
      phone = '+15551234567',
      normalized_email = 'customer.test@shastore.test',
      normalized_phone = '+15551234567',
      status = 'active',
      tags = array(
        select distinct unnest(coalesce(tags, '{}'::text[]) || array['phase-c3', 'phase-c4', 'test-account']::text[])
      ),
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'source', 'phase_c4_commerce_seed',
        'auth_user_id', customer_id
      ),
      updated_at = now()
    where lower(coalesce(normalized_email, email)) = 'customer.test@shastore.test'
    returning id into store_customer_id;

    if store_customer_id is null then
      insert into public.store_customers (
        workspace_id,
        store_id,
        name,
        email,
        phone,
        normalized_email,
        normalized_phone,
        status,
        tags,
        metadata,
        updated_at
      )
      values (
        store_record.workspace_id,
        store_record.id,
        'Customer Test',
        'customer.test@shastore.test',
        '+15551234567',
        'customer.test@shastore.test',
        '+15551234567',
        'active',
        array['phase-c3', 'phase-c4', 'test-account'],
        jsonb_build_object('source', 'phase_c4_commerce_seed', 'auth_user_id', customer_id),
        now()
      )
      returning id into store_customer_id;
    end if;
  end if;

  if to_regclass('public.store_delivery_agents') is not null then
    update public.store_delivery_agents
    set
      workspace_id = store_record.workspace_id,
      store_id = store_record.id,
      name = 'Delivery Test Agent',
      email = 'delivery.test@shastore.test',
      normalized_email = 'delivery.test@shastore.test',
      phone = coalesce(nullif(trim(phone), ''), '+15551234568'),
      normalized_phone = coalesce(nullif(trim(normalized_phone), ''), '+15551234568'),
      status = 'active',
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'source', 'phase_c4_commerce_seed',
        'auth_user_id', delivery_user_id
      ),
      updated_at = now()
    where lower(coalesce(normalized_email, email)) = 'delivery.test@shastore.test'
    returning id into delivery_agent_id;

    if delivery_agent_id is null then
      insert into public.store_delivery_agents (
        workspace_id,
        store_id,
        name,
        email,
        normalized_email,
        phone,
        normalized_phone,
        status,
        metadata,
        updated_at
      )
      values (
        store_record.workspace_id,
        store_record.id,
        'Delivery Test Agent',
        'delivery.test@shastore.test',
        'delivery.test@shastore.test',
        '+15551234568',
        '+15551234568',
        'active',
        jsonb_build_object('source', 'phase_c4_commerce_seed', 'auth_user_id', delivery_user_id),
        now()
      );
    end if;
  end if;
end $$;
