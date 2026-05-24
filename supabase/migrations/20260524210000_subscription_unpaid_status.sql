do $$
begin
  if exists (select 1 from pg_type where typname = 'subscription_status') then
    alter type public.subscription_status add value if not exists 'unpaid';
  end if;
end $$;
