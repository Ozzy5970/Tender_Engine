-- Migration: 20260212020000_fix_system_health_rpc.sql
-- Description: Strict implementation of Plain English System Status RPC
-- Fixes: 400 Bad Request (Ambiguous/Missing Function), Return Type Mismatch

-- 1. Drop existing function to prevent overload confusion
DROP FUNCTION IF EXISTS public.get_admin_system_health(int);

-- 2. Create STRICT single version
CREATE OR REPLACE FUNCTION public.get_admin_system_health(p_hours int default 24)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_error_count int := 0;
    v_critical_count int := 0;
    v_warning_count int := 0;
    v_last_error_at timestamptz;
    v_status text := 'HEALTHY';
    v_recent json;
    v_start_time timestamptz;
BEGIN
    -- 1. Hard Admin Gate
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Access Denied';
    END IF;

    v_start_time := now() - (p_hours || ' hours')::interval;

    -- 2. Gather Stats (Defensive Coalesce)
    -- Assuming error_logs table exists from previous migration. If not, these return 0/null.
    SELECT 
        count(*),
        count(*) FILTER (WHERE severity = 'critical'),
        count(*) FILTER (WHERE severity = 'warning'),
        max(created_at)
    INTO 
        v_error_count,
        v_critical_count,
        v_warning_count,
        v_last_error_at
    FROM public.error_logs 
    WHERE created_at >= v_start_time;

    -- 3. Determine Status
    IF v_critical_count > 0 THEN
        v_status := 'CRITICAL';
    ELSIF v_error_count > 10 OR v_warning_count > 20 THEN
        v_status := 'DEGRADED';
    ELSE
        v_status := 'HEALTHY';
    END IF;

    -- 4. Fetch Recent Errors (Strict Shape)
    SELECT json_agg(json_build_object(
        'id', id,
        'createdAt', created_at,
        'severity', severity,
        'message', message,
        'where', source, -- Map source -> where
        'userId', user_id,
        'email', metadata->>'email', -- Extract if available
        'requestId', metadata->>'requestId',
        'meta', metadata
    )) 
    INTO v_recent
    FROM public.error_logs
    WHERE created_at >= v_start_time
    ORDER BY created_at DESC
    LIMIT 20;

    -- 5. Return EXACT JSON Shape
    RETURN json_build_object(
        'summary', json_build_object(
            'status', v_status,
            'errorCount24h', coalesce(v_error_count, 0),
            'criticalCount24h', coalesce(v_critical_count, 0),
            'warningCount24h', coalesce(v_warning_count, 0),
            'lastErrorAt', v_last_error_at
        ),
        'recent', coalesce(v_recent, '[]'::json)
    );
END;
$$;

-- 3. Force Schema Reload
NOTIFY pgrst, 'reload schema';
