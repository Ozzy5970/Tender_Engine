-- Migration: Admin Analytics & Subscriptions
-- Description: Adds subscriptions table and comprehensive analytics RPC.

-- 1. Create Subscriptions Table
create table if not exists public.subscriptions (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    plan_name text not null, -- 'Pro', 'Enterprise'
    amount decimal(10, 2) not null,
    currency text default 'ZAR',
    status text default 'active', -- 'active', 'cancelled', 'past_due'
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

-- RLS for Subscriptions
alter table public.subscriptions enable row level security;

-- Admin can manage all
create policy "Admins manage subscriptions"
on public.subscriptions for all
using (
    exists (
        select 1 from public.profiles
        where id = auth.uid()
        and is_admin = true
    )
);

-- Users can view own
create policy "Users view own subscription"
on public.subscriptions for select
using (user_id = auth.uid());


-- 2. Analytics RPC
create or replace function get_admin_analytics()
returns json
language plpgsql
security definer
as $$
declare
    total_revenue decimal;
    active_subs int;
    total_users int;
    perfect_compliance_users int;
    growth_data json;
    compliance_data json;
begin
    -- Security Check
    if not exists (select 1 from public.profiles where id = auth.uid() and is_admin = true) then
        raise exception 'Access Denied';
    end if;

    -- Basic Stats
    select coalesce(sum(amount), 0) into total_revenue from public.subscriptions where status = 'active';
    select count(*) into active_subs from public.subscriptions where status = 'active';
    select count(*) into total_users from auth.users;

    -- Approximate "Perfect Compliance" (Users with >= 5 valid documents)
    -- This is a heuristic until we have a materialized compliance score view per user
    select count(*) into perfect_compliance_users
    from (
        select profile_id 
        from public.company_documents 
        where status = 'valid' 
        group by profile_id 
        having count(*) >= 5
    ) as valid_users;

    -- Growth Data (Last 6 Months User Signups)
    select json_agg(t) into growth_data
    from (
        select 
            to_char(date_trunc('month', created_at), 'Mon') as name,
            count(*) as users
        from auth.users
        where created_at > now() - interval '6 months'
        group by date_trunc('month', created_at)
        order by date_trunc('month', created_at)
    ) t;

    -- Compliance Health (Breakdown)
    select json_build_object(
        'compliant', perfect_compliance_users,
        'at_risk', total_users - perfect_compliance_users
    ) into compliance_data;

    return json_build_object(
        'revenue', total_revenue,
        'active_subscriptions', active_subs,
        'total_users', total_users,
        'perfect_score', perfect_compliance_users,
        'user_growth', coalesce(growth_data, '[]'::json),
        'compliance_split', compliance_data
    );
end;
$$;
