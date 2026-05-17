-- Migration: Admin Error Logs V1 Foundation
-- Description: Adds status, deduplication, and metadata to error_logs. Creates log_system_error RPC. Updates health RPCs.

BEGIN;

-- 1. Add new columns with safe defaults
ALTER TABLE public.error_logs 
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'seen', 'resolved', 'ignored')),
  ADD COLUMN IF NOT EXISTS seen_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS seen_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS resolved_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ignored_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS ignored_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS occurrence_count integer NOT NULL DEFAULT 1 CHECK (occurrence_count > 0),
  ADD COLUMN IF NOT EXISTS fingerprint text NULL,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 2. Backfill existing rows (most handled by defaults, but let's ensure dates match created_at)
UPDATE public.error_logs 
SET last_seen_at = created_at, updated_at = created_at 
WHERE last_seen_at > created_at; -- effectively updates all old rows to match their creation time if they just got the 'now()' default.

-- 3. Add Indexes
CREATE INDEX IF NOT EXISTS idx_error_logs_status_created_at ON public.error_logs(status, created_at desc);
CREATE INDEX IF NOT EXISTS idx_error_logs_severity_status_created_at ON public.error_logs(severity, status, created_at desc);
CREATE INDEX IF NOT EXISTS idx_error_logs_fingerprint_status ON public.error_logs(fingerprint, status);

-- 4. Create log_system_error RPC
CREATE OR REPLACE FUNCTION public.log_system_error(
    p_page text DEFAULT 'unknown',
    p_description text DEFAULT 'Unknown error',
    p_stack_trace text DEFAULT NULL,
    p_severity text DEFAULT 'warning',
    p_fingerprint text DEFAULT NULL,
    p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_user_id uuid;
    v_fingerprint text;
    v_severity text;
    v_existing_id uuid;
BEGIN
    v_user_id := auth.uid();

    -- A. Validate severity (coerce to warning if invalid)
    IF p_severity IN ('critical', 'warning', 'info') THEN
        v_severity := p_severity;
    ELSE
        v_severity := 'warning';
    END IF;

    -- B. Build effective fingerprint
    IF p_fingerprint IS NOT NULL AND p_fingerprint <> '' THEN
        v_fingerprint := p_fingerprint;
    ELSE
        -- Deterministic fallback: severity + page + first 100 chars of description
        v_fingerprint := md5(v_severity || '|' || p_page || '|' || left(p_description, 100));
    END IF;

    -- C. Dedupe
    SELECT id INTO v_existing_id
    FROM public.error_logs
    WHERE fingerprint = v_fingerprint AND status IN ('open', 'seen')
    ORDER BY last_seen_at DESC NULLS LAST, created_at DESC NULLS LAST
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
        UPDATE public.error_logs
        SET occurrence_count = occurrence_count + 1,
            last_seen_at = now(),
            updated_at = now(),
            metadata = COALESCE(error_logs.metadata, '{}'::jsonb) || COALESCE(p_metadata, '{}'::jsonb)
        WHERE id = v_existing_id;
        
        RETURN v_existing_id;
    END IF;

    -- D. Insert new row
    INSERT INTO public.error_logs (
        user_id,
        page,
        description,
        stack_trace,
        severity,
        status,
        fingerprint,
        metadata,
        last_seen_at,
        occurrence_count
    ) VALUES (
        v_user_id,
        p_page,
        p_description,
        p_stack_trace,
        v_severity,
        'open',
        v_fingerprint,
        COALESCE(p_metadata, '{}'::jsonb),
        now(),
        1
    ) RETURNING id INTO v_existing_id;

    RETURN v_existing_id;
END;
$$;

-- Grant access to authenticated only (prevent anon spam)
REVOKE EXECUTE ON FUNCTION public.log_system_error(text, text, text, text, text, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_system_error(text, text, text, text, text, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.log_system_error(text, text, text, text, text, jsonb) TO authenticated;

-- 5. Update health RPCs

-- 5a. get_error_stats
CREATE OR REPLACE FUNCTION public.get_error_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    critical_count int;
    total_count int;
BEGIN
    SELECT count(*) INTO total_count FROM public.error_logs;
    
    SELECT count(*) INTO critical_count 
    FROM public.error_logs 
    WHERE severity = 'critical' 
    AND status = 'open' -- NEW: Only count open critical errors
    AND created_at > (now() - interval '24 hours');

    RETURN json_build_object(
        'critical_24h', critical_count,
        'total', total_count
    );
END;
$$;

-- 5b. get_admin_dashboard_snapshot
CREATE OR REPLACE FUNCTION public.get_admin_dashboard_snapshot()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_total_users int;
    v_active_users int;
    v_revenue_last_30d decimal(10,2);
    v_error_count_24h int;
    v_status text;
    v_snapshot_timestamp bigint;
BEGIN
    IF NOT public.is_admin() THEN RAISE EXCEPTION 'Access Denied'; END IF;

    -- 1. Total Users
    SELECT count(*) INTO v_total_users FROM auth.users;

    -- 2. Active Users (30d)
    SELECT count(*) INTO v_active_users 
    FROM auth.users 
    WHERE last_sign_in_at > (now() - interval '30 days')
       OR created_at > (now() - interval '30 days');

    -- 3. Revenue (LAST 30 DAYS ONLY)
    SELECT coalesce(sum(amount), 0.00) INTO v_revenue_last_30d
    FROM public.subscription_history
    WHERE status = 'paid'
    AND created_at >= (now() - interval '30 days');

    -- 4. System Health
    SELECT count(*) INTO v_error_count_24h 
    FROM public.error_logs 
    WHERE severity = 'critical' 
    AND status = 'open' -- NEW: Only count open critical errors
    AND created_at > (now() - interval '24 hours');

    IF v_error_count_24h > 10 THEN v_status := 'CRITICAL';
    ELSIF v_error_count_24h > 0 THEN v_status := 'DEGRADED';
    ELSE v_status := 'HEALTHY';
    END IF;

    v_snapshot_timestamp := extract(epoch from now()) * 1000;

    RETURN json_build_object(
        'totalUsers', v_total_users,
        'activeUsers', v_active_users,
        'revenueLast30Days', v_revenue_last_30d,
        'systemHealth', json_build_object(
            'status', v_status,
            'errorCount24h', v_error_count_24h
        ),
        'snapshotTimestamp', v_snapshot_timestamp
    );
END;
$$;

COMMIT;
