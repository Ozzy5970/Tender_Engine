-- Migration: 20260209120000_get_admin_revenue_ledger.sql
-- Description: RPC to fetch paginated revenue ledger with proper joins and admin security.

-- 1. Create Index for Performance (if not exists)
CREATE INDEX IF NOT EXISTS idx_sub_history_composite 
ON public.subscription_history (created_at DESC, user_id);

-- 2. Create the RPC
CREATE OR REPLACE FUNCTION get_admin_revenue_ledger(
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
    -- 1. Security Check
    IF NOT EXISTS (SELECT 1 FROM public.admins WHERE id = auth.uid()) THEN
        RAISE EXCEPTION 'Access Denied: User is not an admin';
    END IF;

    -- 2. Calculate Total Revenue for the Period (Aggregated)
    SELECT coalesce(sum(amount), 0.00), count(*)
    INTO v_total_revenue, v_total_count
    FROM public.subscription_history
    WHERE created_at >= p_period_start 
      AND created_at <= p_period_end
      AND status = 'paid';

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
        ORDER BY sh.created_at DESC
        LIMIT p_limit OFFSET p_offset
    )
    SELECT json_agg(json_build_object(
        'id', id,
        'date', created_at, -- Mapping to 'date' for frontend compat
        'amount', amount,
        'currency', currency,
        'status', status,
        'plan', plan_name, -- Mapping to 'plan'
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
