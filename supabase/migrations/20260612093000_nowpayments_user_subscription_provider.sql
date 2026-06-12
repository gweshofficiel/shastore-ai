-- Additive NOWPayments platform billing activation metadata.
-- Does not reset data, weaken RLS, or modify Stripe webhook behavior.

alter table public.user_subscriptions
  add column if not exists provider text not null default 'stripe',
  add column if not exists nowpayments_payment_id text,
  add column if not exists nowpayments_invoice_id text;

create index if not exists user_subscriptions_provider_idx
  on public.user_subscriptions(provider);

create index if not exists user_subscriptions_nowpayments_payment_idx
  on public.user_subscriptions(nowpayments_payment_id)
  where nowpayments_payment_id is not null;
