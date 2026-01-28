-- SAFE WATCH: Subscriptions Table Update
-- Run this in Supabase SQL Editor

-- 1. Create Subscriptions table if it doesn't exist
create table if not exists public.subscriptions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  plan_name text not null,
  status text check (status in ('active', 'canceled', 'past_due', 'trialing')) default 'active',
  current_period_end timestamp with time zone,
  cancel_at_period_end boolean default false,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- 2. Enable RLS
alter table public.subscriptions enable row level security;

-- 3. Policies (Safe drop/create)
drop policy if exists "Users can view own subscription" on subscriptions;
create policy "Users can view own subscription" on subscriptions for select using ( auth.uid() = user_id );

drop policy if exists "Users can update own subscription" on subscriptions;
create policy "Users can update own subscription" on subscriptions for update using ( auth.uid() = user_id );

drop policy if exists "Users can insert own subscription" on subscriptions;
create policy "Users can insert own subscription" on subscriptions for insert with check ( auth.uid() = user_id );

-- 4. Add missing columns safely (if table already existed but lacked fields)
do $$ 
begin
  if not exists (select 1 from information_schema.columns where table_name='subscriptions' and column_name='cancel_at_period_end') then
    alter table subscriptions add column cancel_at_period_end boolean default true; -- Default OFF (True means it cancels)
  else
    -- Update default for future
    alter table subscriptions alter column cancel_at_period_end set default true;
  end if;

  if not exists (select 1 from information_schema.columns where table_name='subscriptions' and column_name='current_period_end') then
    alter table subscriptions add column current_period_end timestamp with time zone;
  end if;
end $$;

-- 5. ENFORCE DEFAULT OFF for existing users (User Request)
update public.subscriptions set cancel_at_period_end = true where status = 'active';
