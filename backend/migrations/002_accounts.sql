-- Clipr free-tier server state: one row per account (email), holding the trial
-- clock and lifetime free-tier usage counters. Run once in the Supabase SQL editor
-- (Dashboard > SQL Editor) before deploying the usage-enforcement code.
--
-- Keyed by email (the billing identity; there's no per-user auth yet). The backend
-- starts the trial the first time it sees an email (on /api/billing/status) and
-- meters regen/voiceover usage here so clearing browser storage can't grant more.

create table if not exists public.accounts (
    email             text        primary key,
    trial_started_at  timestamptz not null default now(),
    regen_used        int         not null default 0,   -- storyboard regenerations
    voiceover_used    int         not null default 0,   -- AI-voiceover renders
    created_at        timestamptz not null default now(),
    updated_at        timestamptz not null default now()
);

-- Service-role key bypasses RLS; enable it with no public policies so the table
-- is never exposed through the anon/public API.
alter table public.accounts enable row level security;
