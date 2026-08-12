-- Ichigo Ichie - public API protection and CGV version source

create table if not exists public.api_rate_limits (
  scope text not null,
  key_hash text not null,
  window_start timestamptz not null,
  count integer not null default 1 check (count > 0),
  updated_at timestamptz not null default now(),
  primary key (scope, key_hash, window_start)
);

create index if not exists idx_api_rate_limits_updated_at
  on public.api_rate_limits(updated_at);

alter table public.api_rate_limits enable row level security;
revoke all on table public.api_rate_limits from anon, authenticated;
grant select, insert, update, delete on table public.api_rate_limits to service_role;

create or replace function public.consume_api_rate_limit(
  p_scope text,
  p_key_hash text,
  p_window_seconds integer,
  p_limit integer
)
returns table(
  allowed boolean,
  remaining integer,
  reset_at timestamptz,
  current_count integer
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_window_start timestamptz;
  v_count integer;
begin
  if p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'invalid rate-limit window';
  end if;
  if p_limit < 1 or p_limit > 10000 then
    raise exception 'invalid rate-limit limit';
  end if;
  if coalesce(length(trim(p_scope)), 0) = 0 or coalesce(length(trim(p_key_hash)), 0) = 0 then
    raise exception 'invalid rate-limit key';
  end if;

  v_window_start := to_timestamp(
    floor(extract(epoch from v_now) / p_window_seconds) * p_window_seconds
  );

  insert into public.api_rate_limits(scope, key_hash, window_start, count, updated_at)
  values (left(p_scope, 80), left(p_key_hash, 96), v_window_start, 1, v_now)
  on conflict (scope, key_hash, window_start)
  do update set
    count = public.api_rate_limits.count + 1,
    updated_at = excluded.updated_at
  returning public.api_rate_limits.count into v_count;

  if random() < 0.02 then
    delete from public.api_rate_limits
    where updated_at < v_now - interval '2 days';
  end if;

  return query select
    v_count <= p_limit,
    greatest(p_limit - v_count, 0),
    v_window_start + make_interval(secs => p_window_seconds),
    v_count;
end;
$$;

revoke execute on function public.consume_api_rate_limit(text, text, integer, integer) from public;
revoke execute on function public.consume_api_rate_limit(text, text, integer, integer) from anon, authenticated;
grant execute on function public.consume_api_rate_limit(text, text, integer, integer) to service_role;

insert into public.site_settings(key, value)
values ('terms_version', to_jsonb('2026-08-12-v1'::text))
on conflict (key) do nothing;
