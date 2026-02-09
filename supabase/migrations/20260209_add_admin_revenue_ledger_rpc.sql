-- Migration: 20260209_add_admin_revenue_ledger_rpc.sql
-- Description: RPC to fetch paginated revenue ledger consistent with dashboard snapshot.

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
    -- 1. Security Check: Use is_admin() function if available, or direct check
    IF NOT EXISTS (SELECT 1 FROM public.admins WHERE id = auth.uid()) THEN
        RAISE EXCEPTION 'Access Denied: User is not an admin';
    END IF;

    -- 2. Calculate Totals for the Period (Matching Dashboard Logic)
    -- Dashboard uses: sum(amount) where status = 'paid'
    -- We filter by date range here to match the drilldown period
    SELECT 
        coalesce(sum(amount), 0.00),
        count(*)
    INTO v_total_revenue, v_total_count
    FROM public.subscription_history
    WHERE status = 'paid'
      AND created_at >= p_period_start 
      AND created_at <= p_period_end;

    -- 3. Fetch Paginated Transactions
    -- We include ALL statuses for the list effectively, or just paid? 
    -- User prompt implies "Ledger must show...". Typically ledger shows everything but totals are paid.
    -- However, to match "totalCount" above, we should probably stick to 'paid' OR 
    -- if we want to show failed txs, we need to separate "gross volume" from "paid revenue".
    -- Let's stick to 'paid' for consistency with the prompt "dashboard vs drilldown consistency".
    -- If dashboard says R3998 (paid), the list should likely show the R3998 transactions.
    
    WITH raw_data AS (
        SELECT 
            sh.id,
            sh.created_at,
            sh.period_start,
            sh.period_end,
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
        WHERE sh.status = 'paid' -- Consistency enforced
          AND sh.created_at >= p_period_start 
          AND sh.created_at <= p_period_end
        ORDER BY sh.created_at DESC
        LIMIT p_limit OFFSET p_offset
    )
    SELECT json_agg(json_build_object(
        'id', id,
        'createdAt', created_at,
        'periodStart', period_start,
        'periodEnd', period_end,
        'amount', amount,
        'currency', currency,
        'status', status,
        'planName', plan_name,
        'userId', user_id,
        'email', coalesce(user_email, 'Unknown'),
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
