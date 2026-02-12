-- Migration: Production Security Hardening V3.1 (Final)
-- Description: Locks down RPCs, sets strict Templates RLS, and hardens Error Logs.
-- Fix: Uses %I for safe policy dropping.

-- ==============================================================================
-- 1. Lock Down Admin RPC Execution Surface (Dynamic & Idempotent)
-- ==============================================================================
DO $$
DECLARE
    func_record record;
BEGIN
    FOR func_record IN
        SELECT n.nspname, p.proname, p.oid::regprocedure as signature
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' AND p.proname LIKE 'get_admin_%'
    LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon;', func_record.signature);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role;', func_record.signature);
        
        RAISE NOTICE 'Secured RPC: %', func_record.signature;
    END LOOP;
END $$;


-- ==============================================================================
-- 2. Templates Security (Clean & Strict)
-- ==============================================================================
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

-- 2.1 Drop ALL existing policies dynamically to ensure clean slate
DO $$
DECLARE
    pol_row record;
BEGIN
    FOR pol_row IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'templates'
    LOOP
        EXECUTE format('DROP POLICY %I ON public.templates;', pol_row.policyname);
    END LOOP;
END $$;

-- 2.2 Recreate Strict Policies

-- Public Read (Anon + Authenticated)
CREATE POLICY "templates_public_read"
ON public.templates FOR SELECT
USING (true);

-- Admin Write (Insert)
CREATE POLICY "templates_admin_write"
ON public.templates FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

-- Admin Update
CREATE POLICY "templates_admin_update"
ON public.templates FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Admin Delete
CREATE POLICY "templates_admin_delete"
ON public.templates FOR DELETE
TO authenticated
USING (public.is_admin());


-- ==============================================================================
-- 3. Secrets & Legacy Cleanup
-- ==============================================================================

-- Drop legacy triggers explicitly
DROP TRIGGER IF EXISTS "notify-errors" ON public.error_logs;
DROP TRIGGER IF EXISTS "notify-feedback" ON public.user_feedback;
DROP TRIGGER IF EXISTS "on_feedback_created" ON public.user_feedback;
DROP TRIGGER IF EXISTS "on_error_logged" ON public.error_logs;

-- Drop legacy functions
DROP FUNCTION IF EXISTS public.trigger_admin_notification();
DROP FUNCTION IF EXISTS public.enforce_error_logs_user_id();
DROP FUNCTION IF EXISTS public.force_error_log_user_id();
DROP FUNCTION IF EXISTS public.enforce_error_log_user_id(); 


-- ==============================================================================
-- 4. Error Logs Hardening (Strict)
-- ==============================================================================
ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

-- 4.1 Drop ALL existing policies dynamically
DO $$
DECLARE
    pol_row record;
BEGIN
    FOR pol_row IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'error_logs'
    LOOP
        EXECUTE format('DROP POLICY %I ON public.error_logs;', pol_row.policyname);
    END LOOP;
END $$;

-- 4.2 Cleanup Triggers
DROP TRIGGER IF EXISTS trg_enforce_error_logs_user_id ON public.error_logs;
DROP TRIGGER IF EXISTS trg_force_error_log_user_id ON public.error_logs;
DROP TRIGGER IF EXISTS enforce_user_id ON public.error_logs;
DROP TRIGGER IF EXISTS enforce_error_user_id ON public.error_logs;

-- 4.3 Hardened Trigger Function
CREATE OR REPLACE FUNCTION public.fn_force_error_log_user_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
    NEW.user_id := auth.uid();
    RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_force_error_log_user_id() FROM PUBLIC, anon, authenticated;

-- 4.4 Single Authority Trigger
CREATE TRIGGER trg_force_error_log_user_id
BEFORE INSERT ON public.error_logs
FOR EACH ROW
EXECUTE FUNCTION public.fn_force_error_log_user_id();

-- 4.5 Strict Policies

-- Insert Own (Matches user req strictly)
CREATE POLICY "error_logs_insert_own"
ON public.error_logs FOR INSERT
TO authenticated
WITH CHECK (user_id IS NULL OR user_id = auth.uid());

-- Admin Manage
CREATE POLICY "error_logs_select_admin"
ON public.error_logs FOR SELECT
TO authenticated
USING (public.is_admin());

CREATE POLICY "error_logs_delete_admin"
ON public.error_logs FOR DELETE
TO authenticated
USING (public.is_admin());
