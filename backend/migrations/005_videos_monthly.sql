-- Monthly video-render allowance (services/usage.py).
-- Free: 10 videos/month; Pro: 20 videos/month. Counters reset when videos_period
-- (YYYY-MM) rolls over — the backend resets the row before reserving a credit.
-- Safe to run more than once.

alter table public.accounts
  add column if not exists videos_used   int  not null default 0,
  add column if not exists videos_period text;

-- Extend the atomic reserve / refund helpers to cover videos_used.
create or replace function clipr_consume_usage(p_email text, p_field text, p_limit integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_val integer;
begin
  if p_field not in ('regen_used', 'voiceover_used', 'videos_used') then
    raise exception 'invalid usage field: %', p_field;
  end if;
  execute format(
    'update accounts
        set %1$I = coalesce(%1$I, 0) + 1, updated_at = now()
      where email = $1 and coalesce(%1$I, 0) < $2
      returning %1$I',
    p_field
  )
  into new_val
  using p_email, p_limit;
  return new_val;
end;
$$;

create or replace function clipr_refund_usage(p_email text, p_field text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_val integer;
begin
  if p_field not in ('regen_used', 'voiceover_used', 'videos_used') then
    raise exception 'invalid usage field: %', p_field;
  end if;
  execute format(
    'update accounts
        set %1$I = greatest(coalesce(%1$I, 0) - 1, 0), updated_at = now()
      where email = $1
      returning %1$I',
    p_field
  )
  into new_val
  using p_email;
  return new_val;
end;
$$;

create or replace function clipr_bump_usage(p_email text, p_field text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_val integer;
begin
  if p_field not in ('regen_used', 'voiceover_used', 'videos_used') then
    raise exception 'invalid usage field: %', p_field;
  end if;
  execute format(
    'update accounts
        set %1$I = coalesce(%1$I, 0) + 1,
            updated_at = now()
      where email = $1
      returning %1$I',
    p_field
  )
  into new_val
  using p_email;
  return new_val;
end;
$$;
