-- Atomic reserve / refund for the free-tier meter (services/usage.py).
--
-- The voiceover/regen credit is now RESERVED up front with a single conditional UPDATE
-- (increment only while still under the limit). Doing the check + increment in one
-- statement makes concurrent same-email requests serialize on the row, so a free user
-- can't fire N parallel renders that all pass a separate read-only check and collectively
-- blow past the cap. If the work the credit paid for doesn't ultimately deliver (a
-- failed/OOM'd render, or a voiceover that fell back to music-only), refund releases it.
--
-- usage.reserve()/refund() call these via supabase.rpc(...) and fall back to the
-- non-atomic gate+increment / decrement if the functions are absent, so the meter keeps
-- working before this migration is applied. Safe to run more than once.

create or replace function clipr_consume_usage(p_email text, p_field text, p_limit integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_val integer;
begin
  if p_field not in ('regen_used', 'voiceover_used') then
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
  return new_val;  -- NULL when already at/over the limit (no row updated)
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
  if p_field not in ('regen_used', 'voiceover_used') then
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
