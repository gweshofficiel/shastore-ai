alter table public.user_subscriptions
add column if not exists grace_period_until timestamptz;

create index if not exists user_subscriptions_grace_period_until_idx
  on public.user_subscriptions(grace_period_until)
  where grace_period_until is not null;
