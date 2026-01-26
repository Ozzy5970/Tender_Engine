-- Migration: 20260126170000_subscription_history.sql
-- Description: history table for subscriptions to power revenue analytics

-- 1. Create Subscription History Table
create table public.subscription_history (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    
    plan_name text not null, -- 'Free', 'Standard', 'Pro'
    amount decimal(10,2) not null default 0.00,
    currency text default 'ZAR',
    status text default 'paid', -- 'paid', 'pending', 'failed'
    
    period_start timestamp with time zone default now(),
    period_end timestamp with time zone,
    
    created_at timestamp with time zone default now()
);

-- 2. Index for fast revenue queries
create index idx_sub_history_date on public.subscription_history(created_at);
create index idx_sub_history_user on public.subscription_history(user_id);

-- 3. Enable RLS
alter table public.subscription_history enable row level security;

-- Admin View Policy (assuming admins have a way to view all, or we use Service Role in API)
-- User View Own Policy
create policy "users_view_own_history" on public.subscription_history
    for select using (auth.uid() = user_id);

-- 4. Trigger to auto-log changes from 'subscriptions' table (if it exists)
-- Assuming a 'subscriptions' table exists from previous context, or we just use this as the primary log.
-- Let's check if 'subscriptions' table exists first. The previous code referenced `supabase.from('subscriptions')`.

do $$
begin
    if not exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'subscriptions') then
        -- Create a simple current subscriptions table if it's missing (it was referenced in api.ts)
        create table public.subscriptions (
            id uuid default gen_random_uuid() primary key,
            user_id uuid references auth.users(id) on delete cascade not null unique,
            plan_name text default 'Free',
            status text default 'active',
            current_period_end timestamp with time zone,
            created_at timestamp with time zone default now(),
            updated_at timestamp with time zone default now()
        );
        alter table public.subscriptions enable row level security;
        create policy "users_view_own_sub" on public.subscriptions for select using (auth.uid() = user_id);
    end if;
end
$$;

-- Trigger Function to log history on subscription change/insert
create or replace function public.log_subscription_change()
returns trigger
language plpgsql
security definer
as $$
declare
    v_amount decimal(10,2);
begin
    -- Determine amount based on plan (Hardcoded pricing logic for history)
    if new.plan_name = 'Pro' then v_amount := 1999.00;
    elsif new.plan_name = 'Standard' then v_amount := 499.00;
    else v_amount := 0.00;
    end if;

    -- Only insert history if plan changed or it's a new subscription
    if (tg_op = 'INSERT') or (tg_op = 'UPDATE' and old.plan_name is distinct from new.plan_name) then
        insert into public.subscription_history (user_id, plan_name, amount, period_start, period_end)
        values (new.user_id, new.plan_name, v_amount, now(), new.current_period_end);
    end if;
    
    return new;
end;
$$;

-- Attach Trigger to subscriptions table
drop trigger if exists on_subscription_change on public.subscriptions;
create trigger on_subscription_change
    after insert or update on public.subscriptions
    for each row execute procedure public.log_subscription_change();
