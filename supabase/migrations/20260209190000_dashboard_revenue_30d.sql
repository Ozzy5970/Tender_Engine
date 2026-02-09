-- Migration: 20260209190000_dashboard_revenue_30d.sql
-- Description: Update get_admin_dashboard_snapshot to return revenueLast30Days (Last 30 Days) instead of Lifetime.

CREATE OR REPLACE FUNCTION get_admin_dashboard_snapshot()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_total_users int;
    v_active_users int;
    v_revenue_last_30d decimal(10,2); -- NEW VARIABLE
    v_error_count_24h int;
    v_status text;
    v_snapshot_timestamp bigint;
BEGIN
    IF NOT public.is_admin() THEN RAISE EXCEPTION 'Access Denied'; END IF;

    -- 1. Total Users
    select count(*) into v_total_users from auth.users;

    -- 2. Active Users (30d)
    select count(*) into v_active_users 
    from auth.users 
    where last_sign_in_at > (now() - interval '30 days')
       or created_at > (now() - interval '30 days');

    -- 3. Revenue (LAST 30 DAYS ONLY)
    select coalesce(sum(amount), 0.00) into v_revenue_last_30d
    from public.subscription_history
    where status = 'paid'
    and created_at >= (now() - interval '30 days'); -- TIME FILTER ADDED

    -- 4. System Health
    select count(*) into v_error_count_24h 
    from public.error_logs 
    where severity = 'critical' 
    and created_at > (now() - interval '24 hours');

    if v_error_count_24h > 10 then v_status := 'CRITICAL';
    elsif v_error_count_24h > 0 then v_status := 'DEGRADED';
    else v_status := 'HEALTHY';
    end if;

    v_snapshot_timestamp := extract(epoch from now()) * 1000;

    return json_build_object(
        'totalUsers', v_total_users,
        'activeUsers', v_active_users,
        'revenueLast30Days', v_revenue_last_30d, -- RENAMED KEY
        'systemHealth', json_build_object(
            'status', v_status,
            'errorCount24h', v_error_count_24h
        ),
        'snapshotTimestamp', v_snapshot_timestamp
    );
END;
$$;
