-- LEGAL SAFETY LAYER UPDATE
-- Run this in Supabase SQL Editor

-- 1. Create Legal Consents Table (if not exists)
create table if not exists public.legal_consents (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  version text not null,
  accepted_at timestamp with time zone default now(),
  unique(user_id, version)
);

-- 2. Enable Security (RLS)
alter table public.legal_consents enable row level security;

-- 3. Add Policies (Drop first to avoid errors if re-running)
drop policy if exists "Users can view own consents" on legal_consents;
create policy "Users can view own consents" 
  on legal_consents for select 
  using ( auth.uid() = user_id );

drop policy if exists "Users can insert own consents" on legal_consents;
create policy "Users can insert own consents" 
  on legal_consents for insert 
  with check ( auth.uid() = user_id );
