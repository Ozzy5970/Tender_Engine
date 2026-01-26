-- MASTER SYNC MIGRATION
-- Purpose: Ensure strict database schema compliance by checking ALL required columns exist.
-- Safe to run multiple times (Idempotent).

-- 1. PROFILES: Ensure all fields exist
alter table public.profiles 
add column if not exists full_name text,
add column if not exists phone text,
add column if not exists address text,
add column if not exists location text,
add column if not exists company_name text,
add column if not exists tier text default 'Tier 1',
add column if not exists notify_email_tier_support boolean default false,
add column if not exists notify_whatsapp_tier_reminders boolean default false,
add column if not exists notify_email_critical_errors boolean default false,
add column if not exists whatsapp_number text;

-- 2. TENDERS: Ensure tracking columns exist
alter table public.tenders 
add column if not exists has_rated boolean default false;

-- 3. SUBSCRIPTIONS: Ensure history tracking is robust
-- (Usually managed by stripe_customer_id in profiles, but we have a history table)
-- Just checking indexes here lightly.
create index if not exists idx_profiles_tier on public.profiles(tier);

-- 4. FEEDBACK: Ensure table exists (if entire migration skipped)
create table if not exists public.user_feedback (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.profiles(id) on delete cascade not null,
    tender_id uuid references public.tenders(id) on delete set null,
    rating int not null check (rating >= 1 and rating <= 5),
    message text,
    created_at timestamptz default now()
);

-- 5. ERROR LOGS: Ensure table exists
create table if not exists public.error_logs (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.profiles(id) on delete set null,
    page text,
    description text,
    stack_trace text,
    severity text check (severity in ('critical', 'warning', 'info')),
    created_at timestamptz default now()
);

-- 6. RLS: Ensure Policies exist (Idempotent creation is tricky in pure SQL without DO blocks)
-- We will assume RLS is enabled if tables exist.
alter table public.profiles enable row level security;
alter table public.user_feedback enable row level security;
alter table public.error_logs enable row level security;

-- 7. NOTIFICATION TRIGGER (Clean up old ones just in case)
drop trigger if exists on_feedback_created on public.user_feedback;
drop trigger if exists on_error_logged on public.error_logs;
drop function if exists public.trigger_admin_notification();
-- (We use Webhooks now, so we remove the logic triggers)
