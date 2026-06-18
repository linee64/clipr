-- Clipr billing: one row per customer's Polar subscription state.
-- Run this once in the Supabase SQL editor (Dashboard > SQL Editor > New query)
-- before deploying the billing code. Keyed by email (the billing identity, since
-- there's no per-user auth yet). The backend writes here from the Polar webhook and
-- from on-demand reconciliation; reads here to decide Pro vs Free.

create table if not exists public.subscriptions (
    email                 text primary key,
    active                boolean     not null default false,
    status                text        not null default '',   -- trialing | active | canceled | past_due | revoked | ...
    current_period_end    timestamptz,
    cancel_at_period_end  boolean     not null default false,
    subscription_id       text,
    last_event            text,                               -- last webhook type, or 'reconcile'
    updated_at            timestamptz not null default now()
);

-- Quick filter for "who is on a paid/trialing plan".
create index if not exists subscriptions_active_idx on public.subscriptions (active);
create index if not exists subscriptions_status_idx on public.subscriptions (status);

-- The backend uses the SERVICE ROLE key (bypasses RLS). Enable RLS with no public
-- policies so the table is never exposed through the anon/public API.
alter table public.subscriptions enable row level security;
