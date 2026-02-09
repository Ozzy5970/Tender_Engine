-- Migration: 20260209180000_fix_admin_analytics_column.sql
-- Description: Fixes get_admin_analytics to use correct columns (is_verified) for company_documents.

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
    -- 1. Security Check
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Access Denied';
    END IF;

    -- 2. Lifetime Revenue
    SELECT coalesce(sum(amount), 0.00) INTO v_lifetime_revenue_paid
    FROM public.subscription_history
    WHERE status = 'paid';

    -- 3. MRR & Active Subscriptions
    SELECT 
        coalesce(sum(amount), 0.00),
        count(*) 
    INTO v_mrr_active_subscriptions, v_active_subscriptions
    FROM public.subscriptions 
    WHERE status = 'active';

    -- 4. Total Users & Active 30d
    SELECT count(*) INTO v_total_users FROM auth.users;
    
    SELECT count(*) INTO v_active_users_30d 
    FROM auth.users 
    WHERE last_sign_in_at > (now() - interval '30 days')
       OR created_at > (now() - interval '30 days');

    -- 5. Error Count 24h
    SELECT count(*) INTO v_error_count_24h
    FROM public.error_logs
    WHERE severity = 'critical'
      AND created_at > (now() - interval '24 hours');

    -- 6. Perfect Compliance (Approximate)
    -- FIXED: Used 'status' column which doesn't exist. Switched to 'is_verified'.
    SELECT count(*) INTO v_perfect_compliance_users
    FROM (
        SELECT profile_id 
        FROM public.company_documents 
        WHERE is_verified = true 
          AND (expiry_date IS NULL OR expiry_date >= CURRENT_DATE)
        GROUP BY profile_id 
        HAVING count(*) >= 5
    ) as valid_users;

    -- 7. Growth Data
    SELECT json_agg(t) INTO v_growth_series
    FROM (
        SELECT 
            to_char(date_trunc('month', created_at), 'Mon') as name,
            count(*) as users
        FROM auth.users
        WHERE created_at > now() - interval '6 months'
        GROUP BY date_trunc('month', created_at)
        ORDER BY date_trunc('month', created_at)
    ) t;

    -- 8. Compliance Health
    SELECT json_build_object(
        'compliant', v_perfect_compliance_users,
        'at_risk', v_total_users - v_perfect_compliance_users
    ) INTO v_compliance_split;

    -- 9. Return camelCase JSON
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
