-- Migration: 20260202120000_fix_rls_recursion_and_sync.sql
-- Description: Comprehensive fix for RLS recursion, Admin Sync, and Safety Hardening.

-- =====================================================================
-- 1. SAFETY & PERFORMANCE HARDENING
-- =====================================================================

-- Add missing foreign key indexes to prevent RLS performance degradation
-- These are critical for 2000+ companies to avoid seq scans on large tables
CREATE INDEX IF NOT EXISTS idx_company_docs_profile ON public.company_documents(profile_id);
CREATE INDEX IF NOT EXISTS idx_compliance_reqs_tender ON public.compliance_requirements(tender_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tender ON public.audit_logs(tender_id);
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON public.profiles(is_admin) WHERE is_admin = true;

-- =====================================================================
-- 2. REPAIR SECURITY VULNERABILITIES
-- =====================================================================

-- Fix search_path injection vulnerability in Admin RPC
DROP FUNCTION IF EXISTS public.get_admin_users();
CREATE OR REPLACE FUNCTION public.get_admin_users()
RETURNS TABLE (
    id uuid,
    email text,
    full_name text,
    company_name text,
    registration_number text,
    tax_reference_number text,
    cidb_grade text,
    bbbee_level int,
    created_at timestamptz,
    last_sign_in_at timestamptz,
    last_seen_at timestamptz,
    doc_count bigint,
    sub_status text,
    sub_plan text,
    has_history boolean,
    profile_complete boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public -- FIXED: Explicit search_path
AS $$
BEGIN
    -- Use the physical table check (fast, non-recursive)
    IF NOT EXISTS (SELECT 1 FROM public.admins a WHERE a.id = auth.uid()) THEN
        RAISE EXCEPTION 'Access Denied';
    END IF;

    RETURN QUERY
    SELECT 
        u.id,
        u.email::text,
        p.full_name::text,
        COALESCE(p.company_name, 'No Profile')::text AS company_name,
        p.registration_number::text,
        p.tax_reference_number::text,
        CASE 
            WHEN p.id IS NULL THEN NULL
            ELSE (COALESCE(p.cidb_grade_grading::text, '') || COALESCE(p.cidb_grade_class, ''))::text 
        END AS cidb_grade,
        p.bbbee_level,
        u.created_at,
        u.last_sign_in_at,
        p.updated_at AS last_seen_at,
        (SELECT COUNT(*) FROM public.company_documents cd WHERE cd.profile_id = u.id) AS doc_count,
        COALESCE(s.status, 'inactive')::text AS sub_status,
        COALESCE(s.plan_name, 'Free Plan')::text AS sub_plan,
        (SELECT COUNT(*) FROM public.subscription_history sh WHERE sh.user_id = u.id) > 0 AS has_history,
        (
            p.full_name IS NOT NULL AND 
            p.company_name IS NOT NULL AND p.company_name != 'New Company' AND
            p.registration_number IS NOT NULL AND
            p.tax_reference_number IS NOT NULL
        ) AS profile_complete
    FROM auth.users u
    LEFT JOIN public.profiles p ON u.id = p.id
    LEFT JOIN public.subscriptions s ON s.user_id = u.id
    ORDER BY u.last_sign_in_at DESC NULLS LAST;
END;
$$;

-- =====================================================================
-- 3. CLEANUP LEGACY RECURSION
-- =====================================================================

-- Aggressively drop objects that might trigger recursion
DROP POLICY IF EXISTS "admins_view_all_profiles" ON public.profiles;
DROP POLICY IF EXISTS "admins_manage_all_profiles" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_logic" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_logic" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_robust" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_robust" ON public.profiles;

DROP POLICY IF EXISTS "admins_view_all_subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "admins_manage_all_subs" ON public.subscriptions;
DROP POLICY IF EXISTS "subs_select_logic" ON public.subscriptions;
DROP POLICY IF EXISTS "subs_select_robust" ON public.subscriptions;

DROP POLICY IF EXISTS "admins_view_all_history" ON public.subscription_history;
DROP POLICY IF EXISTS "admins_manage_all_history" ON public.subscription_history;
DROP POLICY IF EXISTS "history_select_logic" ON public.subscription_history;
DROP POLICY IF EXISTS "history_select_robust" ON public.subscription_history;

-- Drop legacy functions
DROP FUNCTION IF EXISTS public.check_is_admin();
DROP FUNCTION IF EXISTS public.is_admin_check();

-- =====================================================================
-- 4. ADMIN SYNC & REPAIR
-- =====================================================================

-- Ensure the admins table exists (idempotent)
CREATE TABLE IF NOT EXISTS public.admins (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now()
);

-- Enable RLS on admins table (even if it's public read for admins check)
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read for admins table" ON public.admins;
CREATE POLICY "Public read for admins table" ON public.admins FOR SELECT USING (true);

-- Create Sync Trigger Function
CREATE OR REPLACE FUNCTION public.sync_is_admin_to_table()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.is_admin = true THEN
        INSERT INTO public.admins (id) VALUES (NEW.id)
        ON CONFLICT (id) DO NOTHING;
    ELSE
        DELETE FROM public.admins WHERE id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$;

-- Apply Trigger
DROP TRIGGER IF EXISTS on_profile_admin_change ON public.profiles;
CREATE TRIGGER on_profile_admin_change
    AFTER INSERT OR UPDATE OF is_admin ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_is_admin_to_table();

-- RESEED: Ensure all current admins are in the table
INSERT INTO public.admins (id)
SELECT id FROM public.profiles WHERE is_admin = true
ON CONFLICT (id) DO NOTHING;

-- =====================================================================
-- 5. APPLY ROBUST RLS POLICIES
-- =====================================================================

-- helper function is NO LONGER NEEDED for policies if we query the table directly
-- BUT, doing `EXISTS(SELECT 1 FROM admins ...)` inside a policy is fine and fast.
-- It does NOT cause recursion because `admins` table RLS is simple (TRUE) or unrelated.

-- Profiles
DROP POLICY IF EXISTS "profiles_select_final" ON public.profiles;
CREATE POLICY "profiles_select_final" ON public.profiles
    FOR SELECT USING (
        auth.uid() = id OR EXISTS (SELECT 1 FROM public.admins WHERE id = auth.uid())
    );

DROP POLICY IF EXISTS "profiles_update_final" ON public.profiles;
CREATE POLICY "profiles_update_final" ON public.profiles
    FOR UPDATE USING (
        auth.uid() = id OR EXISTS (SELECT 1 FROM public.admins WHERE id = auth.uid())
    );

DROP POLICY IF EXISTS "profiles_insert_final" ON public.profiles;
CREATE POLICY "profiles_insert_final" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Subscriptions
DROP POLICY IF EXISTS "subs_select_final" ON public.subscriptions;
CREATE POLICY "subs_select_final" ON public.subscriptions
    FOR SELECT USING (
        user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.admins WHERE id = auth.uid())
    );

-- History
DROP POLICY IF EXISTS "history_select_final" ON public.subscription_history;
CREATE POLICY "history_select_final" ON public.subscription_history
    FOR SELECT USING (
        user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.admins WHERE id = auth.uid())
    );