-- MP-6: Marketplace pricing runtime.
-- Additive pricing_mode layer; preserves pricing_type for backward compatibility.

alter table public.marketplace_items
  add column if not exists pricing_mode text null,
  add column if not exists billing_interval text null,
  add column if not exists trial_days integer not null default 0,
  add column if not exists pricing_updated_at timestamptz null;

update public.marketplace_items
set pricing_mode = case
  when pricing_type = 'subscription' then 'subscription'
  when pricing_type in ('paid', 'premium') then 'paid'
  else 'free'
end
where pricing_mode is null;

update public.marketplace_items
set price_amount = 0
where pricing_mode = 'free';

update public.marketplace_items
set billing_interval = null
where pricing_mode in ('free', 'paid');

update public.marketplace_items
set billing_interval = 'monthly'
where pricing_mode = 'subscription' and billing_interval is null;

update public.marketplace_items
set price_amount = 1
where pricing_mode in ('paid', 'subscription') and (price_amount is null or price_amount <= 0);

update public.marketplace_items
set currency = 'USD'
where currency is null;

update public.marketplace_items
set pricing_mode = 'free'
where pricing_mode is null;

alter table public.marketplace_items
  alter column pricing_mode set default 'free';

alter table public.marketplace_items
  alter column pricing_mode set not null;

alter table public.marketplace_items
  drop constraint if exists marketplace_items_pricing_mode_check;

alter table public.marketplace_items
  add constraint marketplace_items_pricing_mode_check
  check (pricing_mode in ('free', 'paid', 'subscription'));

alter table public.marketplace_items
  drop constraint if exists marketplace_items_billing_interval_check;

alter table public.marketplace_items
  add constraint marketplace_items_billing_interval_check
  check (
    billing_interval is null
    or billing_interval in ('monthly', 'yearly')
  );

alter table public.marketplace_items
  drop constraint if exists marketplace_items_currency_check;

alter table public.marketplace_items
  add constraint marketplace_items_currency_check
  check (currency is null or currency in ('USD', 'EUR', 'MAD'));

create index if not exists marketplace_items_pricing_mode_idx
  on public.marketplace_items(pricing_mode, pricing_updated_at desc nulls last);

create or replace function public.marketplace_items_guard_pricing()
returns trigger
language plpgsql
as $$
begin
  if new.pricing_mode not in ('free', 'paid', 'subscription') then
    raise exception 'Invalid marketplace pricing_mode: %', new.pricing_mode;
  end if;

  if new.currency is not null and new.currency not in ('USD', 'EUR', 'MAD') then
    raise exception 'Invalid marketplace currency: %', new.currency;
  end if;

  if new.pricing_mode = 'free' then
    if coalesce(new.price_amount, 0) <> 0 then
      raise exception 'Free marketplace items must have price_amount = 0';
    end if;
    if new.billing_interval is not null then
      raise exception 'Free marketplace items must not have billing_interval';
    end if;
  elsif new.pricing_mode = 'paid' then
    if coalesce(new.price_amount, 0) <= 0 then
      raise exception 'Paid marketplace items must have price_amount > 0';
    end if;
    if new.billing_interval is not null then
      raise exception 'Paid marketplace items must not have billing_interval';
    end if;
  elsif new.pricing_mode = 'subscription' then
    if coalesce(new.price_amount, 0) <= 0 then
      raise exception 'Subscription marketplace items must have price_amount > 0';
    end if;
    if new.billing_interval not in ('monthly', 'yearly') then
      raise exception 'Subscription marketplace items require monthly or yearly billing_interval';
    end if;
  end if;

  if coalesce(new.trial_days, 0) < 0 then
    raise exception 'Marketplace trial_days cannot be negative';
  end if;

  return new;
end;
$$;

drop trigger if exists marketplace_items_guard_pricing on public.marketplace_items;
create trigger marketplace_items_guard_pricing
before insert or update of pricing_mode, price_amount, currency, billing_interval, trial_days
on public.marketplace_items
for each row
execute function public.marketplace_items_guard_pricing();
