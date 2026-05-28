-- Checkout financial breakdown for SHASTORE AI.
-- Additive only: keeps legacy subtotal/total/delivery columns while adding invoice-ready amounts.

alter table if exists public.orders
  add column if not exists subtotal_amount numeric(12, 2) not null default 0,
  add column if not exists shipping_amount numeric(12, 2) not null default 0,
  add column if not exists total_amount numeric(12, 2) not null default 0,
  add column if not exists taxable_amount numeric(12, 2) not null default 0;

alter table if exists public.store_orders
  add column if not exists subtotal_amount numeric(12, 2) not null default 0,
  add column if not exists shipping_amount numeric(12, 2) not null default 0,
  add column if not exists total_amount numeric(12, 2) not null default 0,
  add column if not exists taxable_amount numeric(12, 2) not null default 0;

update public.orders
set
  subtotal_amount = coalesce(nullif(subtotal_amount, 0), order_subtotal_before_discount, subtotal, 0),
  shipping_amount = coalesce(nullif(shipping_amount, 0), delivery_fee, 0),
  total_amount = coalesce(nullif(total_amount, 0), total, 0),
  taxable_amount = coalesce(nullif(taxable_amount, 0), greatest(coalesce(subtotal, 0) + coalesce(delivery_fee, 0), 0))
where subtotal_amount = 0
   or shipping_amount = 0
   or total_amount = 0
   or taxable_amount = 0;

update public.store_orders
set
  subtotal_amount = coalesce(nullif(subtotal_amount, 0), order_subtotal_before_discount, subtotal, 0),
  shipping_amount = coalesce(nullif(shipping_amount, 0), delivery_fee, 0),
  total_amount = coalesce(nullif(total_amount, 0), total, 0),
  taxable_amount = coalesce(nullif(taxable_amount, 0), greatest(coalesce(subtotal, 0) + coalesce(delivery_fee, 0), 0))
where subtotal_amount = 0
   or shipping_amount = 0
   or total_amount = 0
   or taxable_amount = 0;
