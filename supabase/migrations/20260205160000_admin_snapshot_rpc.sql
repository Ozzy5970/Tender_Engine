-- Migration: 20260205160000_admin_snapshot_rpc.sql
-- Description: RPC to return a single authoritative snapshot for the Admin Dashboard.

create or replace function get_admin_dashboard_snapshot()
returns json
language plpgsql
security definer
as $$
declare
    v_total_users int;
    v_active_users int;
    v_total_revenue decimal(10,2);
    v_error_count_24h int;
    v_status text;
    v_snapshot_timestamp bigint;
begin
    -- 1. Total Users (All users in auth.users)
    select count(*) into v_total_users from auth.users;

    -- 2. Active Users (Users who have logged in within last 30 days OR created account in last 30 days)
    -- Note: auth.users has last_sign_in_at
    select count(*) into v_active_users 
    from auth.users 
    where last_sign_in_at > (now() - interval '30 days')
       or created_at > (now() - interval '30 days');

    -- 3. Total Revenue (Sum of 'amount' from subscription_history where status = 'paid')
    -- We assume subscription_history is the ledger.
    select coalesce(sum(amount), 0.00) into v_total_revenue
    from public.subscription_history
    where status = 'paid';

    -- 4. System Health (Critical Errors in last 24h)
    select count(*) into v_error_count_24h 
    from public.error_logs 
    where severity = 'critical' 
    and created_at > (now() - interval '24 hours');

    -- Determine Status based on errors
    if v_error_count_24h > 10 then
        v_status := 'CRITICAL';
    elsif v_error_count_24h > 0 then
        v_status := 'DEGRADED';
    else
        v_status := 'HEALTHY';
    end if;

    -- Timestamp for cache validation
    v_snapshot_timestamp := extract(epoch from now()) * 1000;

    -- Return Single JSON Object
    return json_build_object(
        'totalUsers', v_total_users,
        'activeUsers', v_active_users,
        'totalRevenue', v_total_revenue,
        'systemHealth', json_build_object(
            'status', v_status,
            'errorCount24h', v_error_count_24h
        ),
        'snapshotTimestamp', v_snapshot_timestamp
    );
end;
$$;
