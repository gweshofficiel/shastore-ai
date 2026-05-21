alter table public.commerce_payment_settings
  add column if not exists default_whatsapp_number text,
  add column if not exists stripe_seller_enabled boolean not null default false,
  add column if not exists paypal_seller_enabled boolean not null default false,
  add column if not exists crypto_enabled boolean not null default false,
  add column if not exists payment_instructions text;

update public.commerce_payment_settings
set
  stripe_seller_enabled = coalesce(stripe_seller_enabled, stripe_enabled, false),
  paypal_seller_enabled = coalesce(paypal_seller_enabled, paypal_enabled, false)
where stripe_enabled = true
   or paypal_enabled = true;
