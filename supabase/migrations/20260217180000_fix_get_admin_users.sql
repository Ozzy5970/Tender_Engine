-- Migration: Fix Admin Users RPC (Correct Doc Count & Add Role)
-- Description: Updates get_admin_users to count from compliance_documents (canonical) and return a role field.

CREATE OR REPLACE FUNCTION public.get_admin_users()
RETURNS TABLE (
    id uuid,
    email text,
    company_name text,
    cidb_grade text,
    bbbee_level int,
    created_at timestamptz,
    last_sign_in_at timestamptz,
    doc_count bigint,
    sub_status text,
    sub_plan text,
    has_history boolean,
    role text -- NEW FIELD
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
    -- 1. Security Check: Ensure caller is Admin via RPC
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Access Denied: Admin only';
    END IF;

    RETURN QUERY
    SELECT
        p.id,
        u.email::text,
        p.company_name,
        (p.cidb_grade_grading::text || p.cidb_grade_class)::text as cidb_grade,
        p.bbbee_level,
        u.created_at,
        u.last_sign_in_at,
        -- CHANGED: Count from compliance_documents (Canonical) using user_id
        (SELECT count(*) FROM public.compliance_documents cd WHERE cd.user_id = p.id) as doc_count,
        
        -- Subscription Info
        coalesce(s.status, 'free')::text as sub_status,
        coalesce(s.plan_name, 'Free Plan')::text as sub_plan,
        
        -- Check if they ever paid (History > 0)
        (SELECT count(*) FROM public.subscription_history sh WHERE sh.user_id = p.id) > 0 as has_history,

        -- NEW: Role Distinction
        CASE 
            WHEN EXISTS (SELECT 1 FROM public.admins a WHERE a.id = p.id) THEN 'ADMIN' 
            ELSE 'USER' 
        END as role
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.id
    LEFT JOIN public.subscriptions s ON s.user_id = p.id
    ORDER BY u.created_at DESC;
END;
$$;
