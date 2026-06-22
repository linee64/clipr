-- Founder / unlimited Pro: bypass all usage limits (no Polar subscription required).
-- Run once in Supabase SQL Editor after 002_accounts.sql (and 005 if applied).

alter table public.accounts
  add column if not exists is_unlimited boolean not null default false;

-- Clipr founder — permanent unlimited access.
insert into public.accounts (email, is_unlimited)
values ('aidaraltynbek02@gmail.com', true)
on conflict (email) do update
  set is_unlimited = true,
      updated_at = now();
