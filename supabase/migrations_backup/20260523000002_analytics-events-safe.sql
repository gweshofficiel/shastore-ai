-- Real analytics event tracking foundation for SHASTORE AI.
-- Additive and idempotent: no storefront, checkout, billing, or publication changes.

create table if not exists public.analytics_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  visitor_id text not null,
  session_id text not null,
  source_type text not null check (source_type in ('landing', 'store')),
  source_id uuid,
  source_slug text,
  referrer text,
  landing_path text,
  user_agent text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (session_id)
);

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  source_type text not null check (source_type in ('landing', 'store')),
  source_id uuid,
  source_slug text,
  event_type text not null check (
    event_type in (
      'page_view',
      'visitor_session',
      'whatsapp_click',
      'checkout_started',
      'order_created',
      'conversion',
      'product_view'
    )
  ),
  visitor_id text,
  session_id text,
  product_id text,
  product_name text,
  referrer text,
  path text,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists analytics_events_user_type_idx
  on public.analytics_events(user_id, event_type, created_at desc);
create index if not exists analytics_events_source_idx
  on public.analytics_events(source_type, source_id, created_at desc);
create index if not exists analytics_events_slug_idx
  on public.analytics_events(source_type, source_slug, created_at desc);
create index if not exists analytics_events_session_idx
  on public.analytics_events(session_id, created_at desc);
create index if not exists analytics_sessions_user_idx
  on public.analytics_sessions(user_id, last_seen_at desc);

alter table public.analytics_sessions enable row level security;
alter table public.analytics_events enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'analytics_sessions'
      and policyname = 'Users read own analytics sessions'
  ) then
    create policy "Users read own analytics sessions"
      on public.analytics_sessions for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'analytics_events'
      and policyname = 'Users read own analytics events'
  ) then
    create policy "Users read own analytics events"
      on public.analytics_events for select
      using (auth.uid() = user_id);
  end if;
end $$;

do $$
declare
  constraint_row record;
begin
  if to_regclass('public.commerce_analytics_events') is not null then
    for constraint_row in
      select conname
      from pg_constraint
      where conrelid = 'public.commerce_analytics_events'::regclass
        and contype = 'c'
        and pg_get_constraintdef(oid) like '%event_type%'
    loop
      execute format(
        'alter table public.commerce_analytics_events drop constraint if exists %I',
        constraint_row.conname
      );
    end loop;

    alter table public.commerce_analytics_events
      add constraint commerce_analytics_events_event_type_check
      check (
        event_type in (
          'visitor',
          'page_view',
          'visitor_session',
          'whatsapp_click',
          'checkout_started',
          'order_created',
          'conversion',
          'order',
          'product_view'
        )
      );
  end if;
end $$;

create or replace function public.resolve_analytics_source(
  p_source_type text,
  p_source_slug text,
  out resolved_user_id uuid,
  out resolved_source_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
begin
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
    raise exception 'Invalid analytics source type';
  end if;

  if resolved_user_id is null then
    raise exception 'Published analytics source not found';
  end if;
end;
$$;

create or replace function public.track_analytics_event(
  p_source_type text,
  p_source_slug text,
  p_event_type text,
  p_visitor_id text default null,
  p_session_id text default null,
  p_product_id text default null,
  p_product_name text default null,
  p_referrer text default null,
  p_path text default null,
  p_user_agent text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_user_id uuid;
  resolved_source_id uuid;
  inserted_id uuid;
  clean_session_id text := nullif(trim(coalesce(p_session_id, '')), '');
  clean_visitor_id text := nullif(trim(coalesce(p_visitor_id, '')), '');
begin
  select source.resolved_user_id, source.resolved_source_id
    into resolved_user_id, resolved_source_id
    from public.resolve_analytics_source(p_source_type, p_source_slug) as source;

  if clean_session_id is not null then
    insert into public.analytics_sessions (
      user_id,
      visitor_id,
      session_id,
      source_type,
      source_id,
      source_slug,
      referrer,
      landing_path,
      user_agent
    )
    values (
      resolved_user_id,
      coalesce(clean_visitor_id, clean_session_id),
      clean_session_id,
      p_source_type,
      resolved_source_id,
      p_source_slug,
      nullif(p_referrer, ''),
      nullif(p_path, ''),
      nullif(p_user_agent, '')
    )
    on conflict (session_id) do update
      set
        last_seen_at = now(),
        referrer = coalesce(public.analytics_sessions.referrer, excluded.referrer),
        landing_path = coalesce(public.analytics_sessions.landing_path, excluded.landing_path),
        user_agent = coalesce(public.analytics_sessions.user_agent, excluded.user_agent);
  end if;

  insert into public.analytics_events (
    user_id,
    source_type,
    source_id,
    source_slug,
    event_type,
    visitor_id,
    session_id,
    product_id,
    product_name,
    referrer,
    path,
    user_agent,
    metadata
  )
  values (
    resolved_user_id,
    p_source_type,
    resolved_source_id,
    p_source_slug,
    p_event_type,
    clean_visitor_id,
    clean_session_id,
    nullif(p_product_id, ''),
    nullif(p_product_name, ''),
    nullif(p_referrer, ''),
    nullif(p_path, ''),
    nullif(p_user_agent, ''),
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into inserted_id;

  return inserted_id;
end;
$$;

create or replace function public.track_commerce_event(
  p_source_type text,
  p_source_slug text,
  p_event_type text,
  p_visitor_id text default null,
  p_session_id text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_user_id uuid;
  resolved_source_id uuid;
  inserted_id uuid;
begin
  select source.resolved_user_id, source.resolved_source_id
    into resolved_user_id, resolved_source_id
    from public.resolve_analytics_source(p_source_type, p_source_slug) as source;

  insert into public.commerce_analytics_events (
    user_id,
    source_type,
    source_id,
    source_slug,
    event_type,
    visitor_id,
    session_id,
    metadata
  )
  values (
    resolved_user_id,
    p_source_type,
    resolved_source_id,
    p_source_slug,
    p_event_type,
    p_visitor_id,
    p_session_id,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into inserted_id;

  perform public.track_analytics_event(
    p_source_type,
    p_source_slug,
    case when p_event_type = 'visitor' then 'visitor_session' else p_event_type end,
    p_visitor_id,
    p_session_id,
    p_metadata->>'product_id',
    p_metadata->>'product_name',
    p_metadata->>'referrer',
    p_metadata->>'path',
    p_metadata->>'user_agent',
    p_metadata
  );

  return inserted_id;
end;
$$;

grant execute on function public.resolve_analytics_source(text, text) to anon, authenticated;
grant execute on function public.track_analytics_event(text, text, text, text, text, text, text, text, text, text, jsonb) to anon, authenticated;
grant execute on function public.track_commerce_event(text, text, text, text, text, jsonb) to anon, authenticated;

