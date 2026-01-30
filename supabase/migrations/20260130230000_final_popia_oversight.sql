-- 1. SECURITY & POPIA COMPLIANCE (Admin Access)
-- Clean up any existing policies first to avoid "already exists" errors

-- Subscriptions Policy
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "admins_view_all_subscriptions" ON public.subscriptions;
    CREATE POLICY "admins_view_all_subscriptions" ON public.subscriptions
        FOR SELECT USING (
            EXISTS (
                SELECT 1 FROM public.profiles
                WHERE profiles.id = auth.uid()
                AND profiles.is_admin = true
            )
        );
END $$;

-- History Policy
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "admins_view_all_history" ON public.subscription_history;
    CREATE POLICY "admins_view_all_history" ON public.subscription_history
        FOR SELECT USING (
            EXISTS (
                SELECT 1 FROM public.profiles
                WHERE profiles.id = auth.uid()
                AND profiles.is_admin = true
            )
        );
END $$;

-- Profiles Policy
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "admins_view_all_profiles" ON public.profiles;
    CREATE POLICY "admins_view_all_profiles" ON public.profiles
        FOR SELECT USING (
            EXISTS (
                SELECT 1 FROM public.profiles admin
                WHERE admin.id = auth.uid()
                AND admin.is_admin = true
            )
        );
END $$;

-- 2. ACTIVITY TRACKING & OVERSIGHT RPC
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
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = TRUE) THEN
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
        COALESCE(s.status, 'free')::text AS sub_status,
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
    ORDER BY u.created_at DESC;
END;
$$;
