
-- 1. RE-ESTABLISH SECURITY (NON-RECURSIVE)
-- This breaks the loop by checking Admin status via a view that doesn't trigger RLS on itself.

-- Helper View to identify admins
CREATE OR REPLACE VIEW public.admin_users_view 
WITH (security_invoker = false) -- SECURITY DEFINER behavior
AS
  SELECT id FROM public.profiles WHERE is_admin = true;

GRANT SELECT ON public.admin_users_view TO authenticated;

-- Central Admin Check Function
CREATE OR REPLACE FUNCTION public.is_admin_check()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users_view
    WHERE id = auth.uid()
  );
$$;

-- 2. APPLY CLEAN RLS POLICIES

-- Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_recovery_v1" ON public.profiles;
DROP POLICY IF EXISTS "admins_manage_all_profiles" ON public.profiles;

CREATE POLICY "profiles_select_logic" ON public.profiles
    FOR SELECT USING (
        auth.uid() = id OR public.is_admin_check()
    );

CREATE POLICY "profiles_update_logic" ON public.profiles
    FOR UPDATE USING (
        auth.uid() = id OR public.is_admin_check()
    );

-- Subscriptions
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "subs_recovery_v1" ON public.subscriptions;
DROP POLICY IF EXISTS "admins_manage_all_subs" ON public.subscriptions;

CREATE POLICY "subs_select_logic" ON public.subscriptions
    FOR SELECT USING (
        user_id = auth.uid() OR public.is_admin_check()
    );

-- History
ALTER TABLE public.subscription_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "history_recovery_v1" ON public.subscription_history;
DROP POLICY IF EXISTS "admins_manage_all_history" ON public.subscription_history;

CREATE POLICY "history_select_logic" ON public.subscription_history
    FOR SELECT USING (
        user_id = auth.uid() OR public.is_admin_check()
    );

-- 3. UPDATED USER TRACKER RPC
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
AS $$
BEGIN
    IF NOT public.is_admin_check() THEN
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
