-- Migration: 20260212010000_system_health_feature.sql
-- Description: Implement Plain English System Status (RPCs, Tables, Logs)

-- 1. Create Log Tables (if not exist)
CREATE TABLE IF NOT EXISTS public.rpc_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    rpc_name text NOT NULL,
    user_id uuid REFERENCES auth.users(id),
    success boolean DEFAULT false,
    error_code text,
    error_message text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.auth_events (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id),
    event_type text NOT NULL,
    success boolean DEFAULT false,
    error_code text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now()
);

-- 2. Secure RLS for Logs
ALTER TABLE public.rpc_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_events ENABLE ROW LEVEL SECURITY;

-- Allow insert by authenticated users (self-logging)
CREATE POLICY "Allow insert own rpc logs" ON public.rpc_logs
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow insert own auth events" ON public.auth_events
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Allow Admin Read-Only
CREATE POLICY "Admins can view all rpc logs" ON public.rpc_logs
    FOR SELECT TO authenticated
    USING (public.is_admin());

CREATE POLICY "Admins can view all auth events" ON public.auth_events
    FOR SELECT TO authenticated
    USING (public.is_admin());

-- 3. Helper for Safe Logging (Security Definer)
-- This allows logging even if RLS might otherwise block (though strict policies above should suffice)
-- Useful for cross-user errors or system-level logging
CREATE OR REPLACE FUNCTION public.log_system_event(
    p_level text, -- 'INFO', 'WARNING', 'CRITICAL'
    p_layer text, -- 'RPC', 'AUTH', 'DB'
    p_message text,
    p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
    INSERT INTO public.error_logs (
        user_id,
        severity,
        source, -- mapped from layer
        message,
        metadata
    ) VALUES (
        auth.uid(), -- might be null
        p_level,
        p_layer,
        p_message,
        p_metadata
    );
END;
$$;

-- 4. Main System Health RPC
CREATE OR REPLACE FUNCTION public.get_admin_system_health(p_hours int default 24)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_status text := 'HEALTHY';
    v_summary text := 'All systems operational.';
    v_error_count int;
    v_critical_count int;
    v_rpc_failures int;
    v_auth_failures int;
    v_incidents json;
    v_start_time timestamptz;
BEGIN
    -- 1. Admin Gate
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Access Denied';
    END IF;

    v_start_time := now() - (p_hours || ' hours')::interval;

    -- 2. Gather Signals
    SELECT count(*) INTO v_error_count FROM public.error_logs WHERE created_at >= v_start_time;
    SELECT count(*) INTO v_critical_count FROM public.error_logs WHERE created_at >= v_start_time AND severity = 'critical';
    
    -- (Mock/Real) RPC Failures
    SELECT count(*) INTO v_rpc_failures FROM public.rpc_logs WHERE created_at >= v_start_time AND success = false;
    
    -- (Mock/Real) Auth Failures
    SELECT count(*) INTO v_auth_failures FROM public.auth_events WHERE created_at >= v_start_time AND success = false;

    -- 3. Determine Status & Summary (Plain English Logic)
    IF v_critical_count > 0 THEN
        v_status := 'CRITICAL';
        v_summary := format('Critical system health alert: %s critical error(s) detected in the last %s hours. Immediate attention required.', v_critical_count, p_hours);
    ELSIF v_error_count > 10 OR v_rpc_failures > 50 THEN
        v_status := 'DEGRADED';
        v_summary := 'System experiencing degraded performance. Elevated error rates detected.';
    ELSE
        v_status := 'HEALTHY';
        v_summary := 'System is running smoothly. No significant issues detected in the last 24 hours.';
    END IF;

    -- 4. Compile Incidents (Structured)
    WITH distinct_errors AS (
        SELECT 
            id,
            severity,
            message,
            created_at,
            source,
            metadata
        FROM public.error_logs
        WHERE created_at >= v_start_time
        ORDER BY created_at DESC
        LIMIT 20
    )
    SELECT json_agg(json_build_object(
        'id', id,
        'severity', severity,
        'title', 'System Error', -- Enhance with AI or categorization later
        'whatHappened', message,
        'impact', format('User experienced %s error in %s', severity, source),
        'likelyCause', 'Technical fault', -- Placeholder
        'recommendedFix', json_build_array('Check server logs', 'Verify user input'),
        'firstSeenAt', created_at,
        'lastSeenAt', created_at,
        'count', 1, -- Grouping logic can be added here
        'where', json_build_object(
            'layer', source,
            'route', metadata->>'path',
            'table', null
        )
    )) INTO v_incidents
    FROM distinct_errors;

    -- 5. Return Payload
    RETURN json_build_object(
        'status', v_status,
        'summary', v_summary,
        'lastCheckedAt', now(),
        'signals', json_build_object(
            'errors24h', v_error_count,
            'criticalErrors24h', v_critical_count,
            'rpcFailures24h', v_rpc_failures,
            'authFailures24h', v_auth_failures,
            'dbInsertFailures24h', 0 -- Placeholder
        ),
        'incidents', coalesce(v_incidents, '[]'::json),
        'nextActions', CASE 
            WHEN v_status = 'HEALTHY' THEN json_build_array('Monitor system logs')
            ELSE json_build_array('Investigate critical errors', 'Check recent deployments')
        END
    );
END;
$$;
