-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. PROFILES TABLE (Linked to Supabase Auth)
create table public.profiles (
  id uuid references auth.users not null primary key,
  company_name text,
  registration_number text,
  tax_reference text,
  address text,
  updated_at timestamp with time zone,
  
  constraint username_length check (char_length(company_name) >= 3)
);

-- Enable RLS (Security)
alter table public.profiles enable row level security;

-- Policy: Users can only see/edit their own profile
create policy "Users can view own profile" 
  on profiles for select 
  using ( auth.uid() = id );

create policy "Users can update own profile" 
  on profiles for update 
  using ( auth.uid() = id );

-- 2. TENDERS TABLE
create table public.tenders (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  title text not null,
  client text not null,
  deadline date,
  status text check (status in ('draft', 'processing', 'ready', 'error')) default 'draft',
  readiness_score integer default 0,
  created_at timestamp with time zone default now()
);

-- Enable RLS
alter table public.tenders enable row level security;

-- Policy: Users can only see their own tenders
create policy "Users can view own tenders" 
  on tenders for select 
  using ( auth.uid() = user_id );

create policy "Users can insert own tenders" 
  on tenders for insert 
  with check ( auth.uid() = user_id );

-- 3. COMPLIANCE DOCUMENTS TABLE
create table public.compliance_documents (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  title text not null,
  status text check (status in ('valid', 'warning', 'missing')) default 'missing',
  expiry_date date,
  file_name text,
  file_url text,
  created_at timestamp with time zone default now()
);

-- Enable RLS
alter table public.compliance_documents enable row level security;

-- Policy: Users can only see their own docs
create policy "Users can view own compliance docs" 
  on compliance_documents for select 
  using ( auth.uid() = user_id );

create policy "Users can update own compliance docs" 
  on compliance_documents for update 
  using ( auth.uid() = user_id );

-- 4. STORAGE BUCKETS (Script to run in SQL Editor doesn't create buckets, but here is the info)
-- You will need to create a storage bucket named 'tenders' and 'compliance' in the dashboard.
