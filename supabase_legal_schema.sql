-- LEGAL CONSENT TRACKING
-- Stores which version of the ToS the user has accepted.

create table public.legal_consents (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  version text not null, -- e.g. 'v1.0'
  accepted_at timestamp with time zone default now(),
  
  -- Prevent duplicate acceptances for the same version
  unique(user_id, version)
);

-- Enable RLS
alter table public.legal_consents enable row level security;

-- Policy: Users can view their own consents
create policy "Users can view own consents" 
  on legal_consents for select 
  using ( auth.uid() = user_id );

-- Policy: Users can insert their own consent
create policy "Users can insert own consents" 
  on legal_consents for insert 
  with check ( auth.uid() = user_id );
