-- Create videos table if it doesn't exist to track rendered videos.
create table if not exists public.videos (
    id                uuid primary key default gen_random_uuid(),
    email             text,
    job_id            text unique,
    output_url        text,
    source            text default 'ai', -- 'ai' or 'byoc'
    created_at        timestamptz not null default now()
);

-- Enable RLS (Service-role key bypasses RLS).
alter table public.videos enable row level security;

-- Ensure source column exists if the table was already created.
alter table public.videos add column if not exists source text default 'ai';
