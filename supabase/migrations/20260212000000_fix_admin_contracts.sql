-- Migration: 20260212000000_fix_admin_contracts.sql
-- Description: Unifies admin dashboard snapshot and revenue ledger with strict compliance rules.

-- 1. Snapshot RPC (Source of Truth)
CREATE OR REPLACE FUNCTION public.get_admin_dashboard_snapshot()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_total_users int;
  v_active_users int;
  v_revenue_30d decimal(10,2);
  v_error_count_24h int;
  v_status text;
  v_snapshot_timestamp bigint;
BEGIN
  -- Admin gate
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access Denied';
  END IF;

  -- Metrics
  SELECT count(*) INTO v_total_users FROM auth.users;

  SELECT count(*) INTO v_active_users
  FROM auth.users
  WHERE last_sign_in_at > (now() - interval '30 days')
     OR created_at > (now() - interval '30 days');

  -- ✅ 30 day paid revenue (Strict: Paid Only)
  SELECT coalesce(sum(amount), 0.00) INTO v_revenue_30d
  FROM public.subscription_history
  WHERE status = 'paid'
    AND created_at >= (now() - interval '30 days');

  SELECT count(*) INTO v_error_count_24h
  FROM public.error_logs
  WHERE severity = 'critical'
    AND created_at > (now() - interval '24 hours');

  IF v_error_count_24h > 10 THEN v_status := 'CRITICAL';
  ELSIF v_error_count_24h > 0 THEN v_status := 'DEGRADED';
  ELSE v_status := 'HEALTHY';
  END IF;

  v_snapshot_timestamp := extract(epoch from now()) * 1000;

  RETURN json_build_object(
    'totalUsers', v_total_users,
    'activeUsers', v_active_users,

    -- return BOTH keys for a smooth transition
    'revenue30dPaid', v_revenue_30d,
    'revenueLast30Days', v_revenue_30d,

    'systemHealth', json_build_object(
      'status', v_status,
      'errorCount24h', v_error_count_24h
    ),
    'snapshotTimestamp', v_snapshot_timestamp
  );
END;
$$;

-- 2. Ledger RPC (Aligned with Snapshot)
CREATE OR REPLACE FUNCTION public.get_admin_revenue_ledger(
    p_period_start timestamptz,
    p_period_end timestamptz,
    p_limit int default 50,
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
    -- Admin gate
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Access Denied';
    END IF;

    -- 2. Calculate Total Revenue for the Period (Aggregated)
    SELECT coalesce(sum(amount), 0.00), count(*)
    INTO v_total_revenue, v_total_count
    FROM public.subscription_history
    WHERE created_at >= p_period_start 
      AND created_at <= p_period_end
      AND status = 'paid'; -- STRICTLY PAID ONLY

    -- 3. Fetch Paginated Transactions with Joins
    WITH raw_data AS (
        SELECT 
            sh.id,
            sh.created_at,
            sh.amount,
            sh.currency,
            sh.status,
            sh.plan_name,
            sh.user_id,
            u.email as user_email,
            p.company_name
        FROM public.subscription_history sh
        LEFT JOIN auth.users u ON sh.user_id = u.id
        LEFT JOIN public.profiles p ON sh.user_id = p.id
        WHERE sh.created_at >= p_period_start 
          AND sh.created_at <= p_period_end
          AND sh.status = 'paid' -- STRICTLY PAID ONLY to match totals
        ORDER BY sh.created_at DESC
        LIMIT p_limit OFFSET p_offset
    )
    SELECT json_agg(json_build_object(
        'id', id,
        'date', created_at,
        'amount', amount,
        'currency', currency,
        'status', status,
        'plan', plan_name,
        'userId', user_id,
        'userEmail', coalesce(user_email, 'Unknown'),
        'companyName', coalesce(company_name, 'Unknown Company')
    )) INTO v_transactions
    FROM raw_data;

    -- 4. Return Combined Result
    RETURN json_build_object(
        'totalRevenue', v_total_revenue,
        'totalCount', v_total_count,
        'transactions', coalesce(v_transactions, '[]'::json)
    );
END;
$$;
