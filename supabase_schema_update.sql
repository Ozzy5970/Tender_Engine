-- SAFE UPDATE SCRIPT
-- Run this in Supabase SQL Editor. It will skip tables that already exist.

-- 1. Ensure UUID extension is on
create extension if not exists "uuid-ossp";

-- 2. TENDERS TABLE (Create if missing)
create table if not exists public.tenders (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  title text not null,
  client text not null,
  deadline date,
  status text check (status in ('draft', 'processing', 'ready', 'error')) default 'draft',
  readiness_score integer default 0,
  created_at timestamp with time zone default now()
);

-- Enable RLS for Tenders (Safe to run multiple times)
alter table public.tenders enable row level security;
drop policy if exists "Users can view own tenders" on tenders;
create policy "Users can view own tenders" on tenders for select using ( auth.uid() = user_id );
drop policy if exists "Users can insert own tenders" on tenders;
create policy "Users can insert own tenders" on tenders for insert with check ( auth.uid() = user_id );


-- 3. COMPLIANCE DOCUMENTS TABLE (Create if missing)
create table if not exists public.compliance_documents (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  title text not null,
  status text check (status in ('valid', 'warning', 'missing')) default 'missing',
  expiry_date date,
  file_name text,
  file_url text,
  created_at timestamp with time zone default now()
);

-- Enable RLS for Compliance (Safe to run multiple times)
alter table public.compliance_documents enable row level security;
drop policy if exists "Users can view own compliance docs" on compliance_documents;
create policy "Users can view own compliance docs" on compliance_documents for select using ( auth.uid() = user_id );
drop policy if exists "Users can update own compliance docs" on compliance_documents;
create policy "Users can update own compliance docs" on compliance_documents for update using ( auth.uid() = user_id );


-- 4. UPDATE PROFILES (Safely add missing columns to existing table)
do $$ 
begin
  -- Add company_name if missing
  if not exists (select 1 from information_schema.columns where table_name='profiles' and column_name='company_name') then
    alter table profiles add column company_name text;
  end if;

  -- Add registration_number if missing
  if not exists (select 1 from information_schema.columns where table_name='profiles' and column_name='registration_number') then
    alter table profiles add column registration_number text;
  end if;

   -- Add tax_reference if missing
  if not exists (select 1 from information_schema.columns where table_name='profiles' and column_name='tax_reference') then
    alter table profiles add column tax_reference text;
  end if;

   -- Add address if missing
  if not exists (select 1 from information_schema.columns where table_name='profiles' and column_name='address') then
    alter table profiles add column address text;
  end if;
end $$;
