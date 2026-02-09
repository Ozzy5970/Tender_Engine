-- Migration: 20260209160000_admin_auth_hardening.sql
-- Description: Production-grade admin auth. Non-recursive RLS + RPC Gating.

-- 1. Create Helper Function (Bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.admins a WHERE a.id = auth.uid());
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- 2. Fix Admins Table RLS (Non-Recursive, Self-Only)
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies to ensure clean slate
DROP POLICY IF EXISTS "admins_read_policy" ON public.admins;
DROP POLICY IF EXISTS "Public read for admins table" ON public.admins;
DROP POLICY IF EXISTS "Admins can view all admins" ON public.admins;
DROP POLICY IF EXISTS "Users can view own admin status" ON public.admins;
DROP POLICY IF EXISTS "admins_select_self_only" ON public.admins;

-- Create single, strict policy: Users can only see THEIR OWN row in admins table.
-- This prevents "SELECT * FROM admins" from working for anyone (even admins).
-- To check if someone is an admin, use public.is_admin() RPC.
CREATE POLICY "admins_select_self_only"
ON public.admins FOR SELECT TO authenticated
USING (id = auth.uid());

-- Revoke all generic access (Force use of RPCs or Policy)
REVOKE ALL ON TABLE public.admins FROM anon;
REVOKE ALL ON TABLE public.admins FROM authenticated;
GRANT SELECT ON TABLE public.admins TO authenticated; -- Required for RLS policy to work at all

-- 3. Gate RPCs with public.is_admin() check
-- We recreate them to inject the check at the top.

-- A. get_admin_dashboard_snapshot
CREATE OR REPLACE FUNCTION get_admin_dashboard_snapshot()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_total_users int;
    v_active_users int;
    v_total_revenue decimal(10,2);
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

    -- 3. Total Revenue (Paid)
    select coalesce(sum(amount), 0.00) into v_total_revenue
    from public.subscription_history
    where status = 'paid';

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
        'totalRevenue', v_total_revenue,
        'systemHealth', json_build_object(
            'status', v_status,
            'errorCount24h', v_error_count_24h
        ),
        'snapshotTimestamp', v_snapshot_timestamp
    );
END;
$$;

-- B. get_admin_analytics
CREATE OR REPLACE FUNCTION get_admin_analytics()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_lifetime_revenue_paid decimal(10,2);
    v_mrr_active_subscriptions decimal(10,2);
    v_active_subscriptions int;
    v_total_users int;
    v_active_users_30d int;
    v_error_count_24h int;
    v_perfect_compliance_users int;
    v_growth_series json;
    v_compliance_split json;
BEGIN
    IF NOT public.is_admin() THEN RAISE EXCEPTION 'Access Denied'; END IF;

    -- Reuse logic from standardization migration
    SELECT coalesce(sum(amount), 0.00) INTO v_lifetime_revenue_paid FROM public.subscription_history WHERE status = 'paid';
    SELECT coalesce(sum(amount), 0.00), count(*) INTO v_mrr_active_subscriptions, v_active_subscriptions FROM public.subscriptions WHERE status = 'active';
    SELECT count(*) INTO v_total_users FROM auth.users;
    SELECT count(*) INTO v_active_users_30d FROM auth.users WHERE last_sign_in_at > (now() - interval '30 days') OR created_at > (now() - interval '30 days');
    SELECT count(*) INTO v_error_count_24h FROM public.error_logs WHERE severity = 'critical' AND created_at > (now() - interval '24 hours');

    SELECT count(*) INTO v_perfect_compliance_users
    FROM (SELECT profile_id FROM public.company_documents WHERE status = 'valid' GROUP BY profile_id HAVING count(*) >= 5) as valid_users;

    SELECT json_agg(t) INTO v_growth_series
    FROM (
        SELECT to_char(date_trunc('month', created_at), 'Mon') as name, count(*) as users
        FROM auth.users
        WHERE created_at > now() - interval '6 months'
        GROUP BY date_trunc('month', created_at)
        ORDER BY date_trunc('month', created_at)
    ) t;

    SELECT json_build_object('compliant', v_perfect_compliance_users, 'at_risk', v_total_users - v_perfect_compliance_users) INTO v_compliance_split;

    RETURN json_build_object(
        'lifetimeRevenuePaid', v_lifetime_revenue_paid,
        'mrrActiveSubscriptions', v_mrr_active_subscriptions,
        'activeSubscriptions', v_active_subscriptions,
        'totalUsers', v_total_users,
        'activeUsers30d', v_active_users_30d,
        'errorCount24h', v_error_count_24h,
        'perfectComplianceUsers', v_perfect_compliance_users,
        'userGrowthSeries', coalesce(v_growth_series, '[]'::json),
        'complianceSplit', v_compliance_split
    );
END;
$$;

-- C. get_admin_revenue_ledger
CREATE OR REPLACE FUNCTION public.get_admin_revenue_ledger(
    p_period_start timestamptz,
    p_period_end timestamptz,
    p_limit int default 100,
    p_offset int default 0
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_total_revenue decimal(10,2);
    v_total_count int;
    v_transactions json;
BEGIN
    IF NOT public.is_admin() THEN RAISE EXCEPTION 'Access Denied'; END IF;

    SELECT coalesce(sum(amount), 0.00), count(*) INTO v_total_revenue, v_total_count
    FROM public.subscription_history
    WHERE status = 'paid' AND created_at >= p_period_start AND created_at <= p_period_end;

    WITH raw_data AS (
        SELECT sh.id, sh.created_at, sh.period_start, sh.period_end, sh.amount, sh.currency, sh.status, sh.plan_name, sh.user_id, u.email as user_email, p.company_name
        FROM public.subscription_history sh
        LEFT JOIN auth.users u ON sh.user_id = u.id
        LEFT JOIN public.profiles p ON sh.user_id = p.id
        WHERE sh.status = 'paid' AND sh.created_at >= p_period_start AND sh.created_at <= p_period_end
        ORDER BY sh.created_at DESC
        LIMIT p_limit OFFSET p_offset
    )
    SELECT json_agg(json_build_object(
        'id', id, 'createdAt', created_at, 'periodStart', period_start, 'periodEnd', period_end, 'amount', amount, 'currency', currency, 'status', status, 'planName', plan_name, 'userId', user_id, 'email', coalesce(user_email, 'Unknown'), 'companyName', coalesce(company_name, 'Unknown Company')
    )) INTO v_transactions FROM raw_data;

    RETURN json_build_object('totalRevenue', v_total_revenue, 'totalCount', v_total_count, 'transactions', coalesce(v_transactions, '[]'::json));
END;
$$;

-- D. get_admin_users (Assuming standard listing)
DROP FUNCTION IF EXISTS get_admin_users();

CREATE OR REPLACE FUNCTION get_admin_users()
RETURNS TABLE (
    id uuid,
    email varchar,
    created_at timestamptz,
    last_sign_in_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
    IF NOT public.is_admin() THEN RAISE EXCEPTION 'Access Denied'; END IF;
    
    RETURN QUERY
    SELECT u.id, u.email::varchar, u.created_at, u.last_sign_in_at
    FROM auth.users u
    ORDER BY u.created_at DESC;
END;
$$;
