-- Reseller business and store-delivery settings.
-- Resellers sell ready-made stores/templates/services, not physical products.
-- This intentionally does not touch seller shipping, checkout, storefront rendering,
-- platform billing, admin, or public reseller showcase pages.

create table if not exists public.reseller_business_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  business_name text,
  support_email text,
  support_whatsapp text,
  business_website text,
  invoice_notes text,
  store_delivery_method text not null default 'manual' check (
    store_delivery_method in (
      'manual',
      'email_placeholder',
      'whatsapp_placeholder',
      'pdf_access_placeholder',
      'ownership_transfer_placeholder'
    )
  ),
  send_store_access_email boolean not null default false,
  send_store_access_whatsapp boolean not null default false,
  generate_pdf_access_file boolean not null default false,
  generate_invoice_pdf boolean not null default false,
  buyer_thank_you_message text,
  client_onboarding_instructions text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reseller_business_settings_user_id_idx
  on public.reseller_business_settings(user_id);

alter table public.reseller_business_settings enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'reseller_business_settings'
      and policyname = 'Users manage own reseller business settings'
  ) then
    create policy "Users manage own reseller business settings"
      on public.reseller_business_settings for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

create or replace function public.set_reseller_business_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'reseller_business_settings_updated_at') then
    create trigger reseller_business_settings_updated_at
      before update on public.reseller_business_settings
      for each row execute function public.set_reseller_business_settings_updated_at();
  end if;
end $$;
