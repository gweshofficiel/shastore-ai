-- PayPal platform billing runtime support.
-- Additive only: does not modify Stripe or NOWPayments runtime behavior.

alter table public.user_subscriptions
  add column if not exists provider_customer_id text,
  add column if not exists provider_subscription_id text,
  add column if not exists paypal_order_id text,
  add column if not exists paypal_capture_id text;

create index if not exists user_subscriptions_provider_customer_idx
  on public.user_subscriptions(provider, provider_customer_id)
  where provider_customer_id is not null;

create index if not exists user_subscriptions_provider_subscription_idx
  on public.user_subscriptions(provider, provider_subscription_id)
  where provider_subscription_id is not null;

create index if not exists user_subscriptions_paypal_order_idx
  on public.user_subscriptions(paypal_order_id)
  where paypal_order_id is not null;

create index if not exists user_subscriptions_paypal_capture_idx
  on public.user_subscriptions(paypal_capture_id)
  where paypal_capture_id is not null;
