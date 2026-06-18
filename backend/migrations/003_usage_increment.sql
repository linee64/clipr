-- Atomic usage-counter increment for the free-tier meter (services/usage.py).
--
-- The old path read the counter into Python and wrote back value+1, so two concurrent
-- requests for the same email could both read N and both write N+1 — a lost update that
-- undercounts usage and lets a free user slip past the cap. This function does the
-- increment in a single statement inside Postgres, so concurrent calls serialize on the
-- row and the count stays correct.
--
-- usage._bump_sync() calls this via supabase.rpc("clipr_bump_usage", ...) and falls back
-- to the read-modify-write if this function is absent, so applying this migration is what
-- activates the atomic path. Safe to run more than once (CREATE OR REPLACE).

create or replace function clipr_bump_usage(p_email text, p_field text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_val integer;
begin
  -- Allowlist the column name: p_field is interpolated into dynamic SQL, so it must be
  -- one of the known counters and never attacker-controlled text.
  if p_field not in ('regen_used', 'voiceover_used') then
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

  return new_val;  -- NULL if no row matched (caller ensures the row exists first)
end;
$$;
