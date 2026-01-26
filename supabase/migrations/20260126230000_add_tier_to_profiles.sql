-- Migration: Add missing columns for Notification System
alter table public.profiles 
add column if not exists tier text default 'Tier 1',
add column if not exists company_name text;

-- Optional: Create index if querying frequently
create index if not exists idx_profiles_tier on public.profiles(tier);
