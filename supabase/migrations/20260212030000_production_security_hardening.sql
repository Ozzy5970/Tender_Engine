-- Migration: Production Security Hardening
-- Description: Locks down RPCs, Templates, Error Logs, and removes database secrets.

-- ==============================================================================
-- 🔐 STEP 1: Lock Down Admin RPC Execution Surface
-- ==============================================================================

DO $$
DECLARE
    func_record record;
BEGIN
    -- Loop through all functions starting with 'get_admin_'
    FOR func_record IN 
        SELECT n.nspname, p.proname, p.oid::regprocedure as signature
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' AND p.proname LIKE 'get_admin_%'
    LOOP
        -- Revoke ALL from PUBLIC and anon
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon;', func_record.signature);
        
        -- Grant EXECUTE to authenticated and service_role only
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role;', func_record.signature);
        
        RAISE NOTICE 'Secured RPC: %', func_record.signature;
    END LOOP;
END $$;

-- ==============================================================================
-- 🧱 STEP 2: Fix Templates Table Security
-- ==============================================================================

ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies to ensure clean state (Idempotent)
DROP POLICY IF EXISTS "Authenticated users view templates" ON public.templates;
DROP POLICY IF EXISTS "Admins manage templates" ON public.templates;
DROP POLICY IF EXISTS "Everyone can view templates" ON public.templates;
DROP POLICY IF EXISTS "Authenticated users manage templates" ON public.templates;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.templates;
DROP POLICY IF EXISTS "Enable insert for admins only" ON public.templates;
DROP POLICY IF EXISTS "Enable update for admins only" ON public.templates;
DROP POLICY IF EXISTS "Enable delete for admins only" ON public.templates;

-- 2.1 Public Read Access
-- "Public can SELECT templates"
CREATE POLICY "Enable read access for all users"
ON public.templates FOR SELECT
USING (true);

-- 2.2 Admin Write Access (Insert, Update, Delete)
-- "No authenticated user can write templates unless is_admin()"

CREATE POLICY "Enable insert for admins only"
ON public.templates FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY "Enable update for admins only"
ON public.templates FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Enable delete for admins only"
ON public.templates FOR DELETE
TO authenticated
USING (public.is_admin());


-- ==============================================================================
-- 🛡 STEP 3: Fix error_logs Security
-- ==============================================================================

ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can insert errors" ON public.error_logs;
DROP POLICY IF EXISTS "Admins can view errors" ON public.error_logs;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.error_logs;
DROP POLICY IF EXISTS "Enable select for admins only" ON public.error_logs;
DROP POLICY IF EXISTS "Enable delete for admins only" ON public.error_logs;

-- 3.1 Insert Policy
-- "Only authenticated users can INSERT"
CREATE POLICY "Enable insert for authenticated users only"
ON public.error_logs FOR INSERT
TO authenticated
WITH CHECK (true);

-- 3.2 Admin Management (Select + Delete)
CREATE POLICY "Enable select for admins only"
ON public.error_logs FOR SELECT
TO authenticated
USING (public.is_admin());

CREATE POLICY "Enable delete for admins only"
ON public.error_logs FOR DELETE
TO authenticated
USING (public.is_admin());

-- 3.3 Force user_id Trigger
-- "user_id is ALWAYS forced to auth.uid()"

CREATE OR REPLACE FUNCTION public.enforce_error_log_user_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    NEW.user_id := auth.uid();
    RETURN NEW;
END;
$$;

-- Drop duplicate triggers if they exist
DROP TRIGGER IF EXISTS enforce_user_id ON public.error_logs;
DROP TRIGGER IF EXISTS force_error_log_user_id ON public.error_logs;
DROP TRIGGER IF EXISTS on_error_logged ON public.error_logs; -- Secret trigger on same table

-- Create the single authority trigger
CREATE TRIGGER enforce_user_id
BEFORE INSERT ON public.error_logs
FOR EACH ROW
EXECUTE FUNCTION public.enforce_error_log_user_id();


-- ==============================================================================
-- 🔥 STEP 4: REMOVE DATABASE-EMBEDDED SECRETS
-- ==============================================================================

-- Drop triggers using supabase_functions.http_request / pg_net in this context
DROP TRIGGER IF EXISTS on_feedback_created ON public.user_feedback;

-- Drop the function that contained the secrets
DROP FUNCTION IF EXISTS public.trigger_admin_notification();
