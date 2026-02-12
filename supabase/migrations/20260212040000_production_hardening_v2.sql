-- Migration: Production Hardening V2 (Safe)
-- Description: RPC Security, Templates RLS, and Error Log Hardening (Strict)

-- ==============================================================================
-- 1. Lock Down Admin RPC Execution Surface (Fixed Dynamic SQL)
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
-- 2. Templates Security (Idempotent)
-- ==============================================================================

-- Ensure RLS Enabled
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

-- Drop all loose/old policies first
DROP POLICY IF EXISTS "Authenticated users view templates" ON public.templates;
DROP POLICY IF EXISTS "Admins manage templates" ON public.templates;
DROP POLICY IF EXISTS "Everyone can view templates" ON public.templates;
DROP POLICY IF EXISTS "Authenticated users manage templates" ON public.templates;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.templates;
DROP POLICY IF EXISTS "Enable insert for admins only" ON public.templates;
DROP POLICY IF EXISTS "Enable update for admins only" ON public.templates;
DROP POLICY IF EXISTS "Enable delete for admins only" ON public.templates;

-- Public Read
CREATE POLICY "templates_read_public"
ON public.templates FOR SELECT
USING (true);

-- Admin Write (Strict Is_Admin Check)
CREATE POLICY "templates_insert_admin"
ON public.templates FOR INSERT TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY "templates_update_admin"
ON public.templates FOR UPDATE TO authenticated
USING (public.is_admin()) 
WITH CHECK (public.is_admin());

CREATE POLICY "templates_delete_admin"
ON public.templates FOR DELETE TO authenticated
USING (public.is_admin());


-- ==============================================================================
-- 3. Error Logs Hardening (Strict & Clean)
-- ==============================================================================

ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

-- 3.1 Cleanup Duplicate Triggers (Idempotent)
DROP TRIGGER IF EXISTS trg_enforce_error_logs_user_id ON public.error_logs;
DROP TRIGGER IF EXISTS trg_force_error_log_user_id ON public.error_logs;
DROP TRIGGER IF EXISTS enforce_user_id ON public.error_logs;
DROP TRIGGER IF EXISTS enforce_error_user_id ON public.error_logs;
DROP TRIGGER IF EXISTS on_error_logged ON public.error_logs; 

-- Cleanup their functions
DROP FUNCTION IF EXISTS public.enforce_error_log_user_id();
DROP FUNCTION IF EXISTS public.trigger_admin_notification();

-- 3.2 Define Hardened Trigger Function
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

-- Revoke public execution (Internal trigger use only)
REVOKE EXECUTE ON FUNCTION public.fn_force_error_log_user_id() FROM PUBLIC, anon, authenticated;

-- 3.3 Create Single Authority Trigger
CREATE TRIGGER trg_force_error_log_user_id
BEFORE INSERT ON public.error_logs
FOR EACH ROW
EXECUTE FUNCTION public.fn_force_error_log_user_id();

-- 3.4 Recreate Policies
-- Drop existing
DROP POLICY IF EXISTS "Users can insert errors" ON public.error_logs;
DROP POLICY IF EXISTS "Admins can view errors" ON public.error_logs;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.error_logs;
DROP POLICY IF EXISTS "Enable select for admins only" ON public.error_logs;
DROP POLICY IF EXISTS "Enable delete for admins only" ON public.error_logs;
DROP POLICY IF EXISTS "error_logs_insert_own" ON public.error_logs;
DROP POLICY IF EXISTS "error_logs_select_admin" ON public.error_logs;
DROP POLICY IF EXISTS "error_logs_delete_admin" ON public.error_logs;

-- Insert Policy (Per User Request - Requirement #1)
CREATE POLICY "error_logs_insert_own"
ON public.error_logs FOR INSERT
TO authenticated
WITH CHECK (user_id IS NULL OR user_id = auth.uid());

-- Admin Manage Policies
CREATE POLICY "error_logs_select_admin"
ON public.error_logs FOR SELECT
TO authenticated
USING (public.is_admin());

CREATE POLICY "error_logs_delete_admin"
ON public.error_logs FOR DELETE
TO authenticated
USING (public.is_admin());
