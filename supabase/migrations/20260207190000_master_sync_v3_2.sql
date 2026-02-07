-- MASTER SYNC V3.2: Frontend Contract Alignment, Security Hardening & Compatibility
-- Generated at: 2026-02-07
-- Description: Standardizes names (v3.2 Patch: Remove risky view drop, Ensure doc_type enum)

BEGIN;

-- 0. PRE-FLIGHT: Drop Dependent Views to allow column alterations
DROP VIEW IF EXISTS public.view_compliance_summary;
-- (Removed risky drop of company_documents view to avoid cascade issues)

-- =====================================================================
-- 1. TABLE & COLUMN STANDARDIZATION
-- =====================================================================

DO $$
BEGIN
    -- Pre-Migration: Ensure compliance_documents has necessary columns if it already exists
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'compliance_documents') THEN
        EXECUTE 'ALTER TABLE public.compliance_documents ADD COLUMN IF NOT EXISTS is_verified boolean DEFAULT false';
        EXECUTE 'ALTER TABLE public.compliance_documents ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now()';
    END IF;

    -- A. Handle Legacy Table Rename (company_documents -> compliance_documents)
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'company_documents') THEN
        IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'compliance_documents') THEN
            -- Both exist: Migrate Data & Drop Old
            INSERT INTO public.compliance_documents (
                id, user_id, doc_type, file_url, expiry_date, is_verified, created_at, updated_at
            )
            SELECT 
                id, profile_id, doc_type, file_path, expiry_date, is_verified, created_at, updated_at
            FROM public.company_documents
            ON CONFLICT (id) DO NOTHING;
            
            DROP TABLE public.company_documents CASCADE;
        ELSE
            -- Only Old exists: Rename Table & Columns
            ALTER TABLE public.company_documents RENAME TO compliance_documents;
            ALTER TABLE public.compliance_documents RENAME COLUMN profile_id TO user_id;
            ALTER TABLE public.compliance_documents RENAME COLUMN file_path TO file_url;
        END IF;
    END IF;
END $$;

-- B. Ensure Canonical Columns Exist on compliance_documents
ALTER TABLE public.compliance_documents ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE public.compliance_documents ADD COLUMN IF NOT EXISTS status text DEFAULT 'valid'; -- Default to valid per requirement
ALTER TABLE public.compliance_documents ADD COLUMN IF NOT EXISTS file_name text;
ALTER TABLE public.compliance_documents ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE public.compliance_documents ADD COLUMN IF NOT EXISTS reference_number text;
ALTER TABLE public.compliance_documents ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.compliance_documents ADD COLUMN IF NOT EXISTS issue_date timestamptz;

-- Ensure doc_type is enum (Idempotent)
DO $$
BEGIN
    -- check if column is text
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'compliance_documents' 
        AND column_name = 'doc_type' 
        AND data_type = 'text'
    ) THEN
        ALTER TABLE public.compliance_documents 
        ALTER COLUMN doc_type TYPE public.company_doc_type 
        USING doc_type::public.company_doc_type;
    END IF;
    
    -- If it doesn't exist, we assume it's because it was created as enum or will be created.
    -- If it doesn't exist at all, add it as enum?
    -- The user requirement is: "Ensure compliance_documents.doc_type is enum. If it is text, alter type. Do not update any other logic."
    -- So we just run the ALTER if it is text.
END $$;


-- C. Subscription History Fixes & Backfill
ALTER TABLE public.subscription_history ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
-- Backfill NULL created_at
UPDATE public.subscription_history 
SET created_at = COALESCE(period_start, now()) 
WHERE created_at IS NULL;

-- =====================================================================
-- 2. ADMIN SECURITY MODEL & SYNC
-- =====================================================================

-- Ensure Admins Table Exists (Single Source of Truth)
CREATE TABLE IF NOT EXISTS public.admins (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now()
);

-- RLS: Private by Default
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

-- Allow Read ONLY if you are the user or an admin
DROP POLICY IF EXISTS "admins_read_policy" ON public.admins;
CREATE POLICY "admins_read_policy" ON public.admins FOR SELECT USING (
    auth.uid() = id OR EXISTS (SELECT 1 FROM public.admins WHERE id = auth.uid())
);

-- Sync Trigger: profiles.is_admin -> public.admins
CREATE OR REPLACE FUNCTION public.sync_is_admin_to_table()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Fix: Use COALESCE to handle NULLs safely
    IF COALESCE(NEW.is_admin, false) = true THEN
        INSERT INTO public.admins (id) VALUES (NEW.id)
        ON CONFLICT (id) DO NOTHING;
    ELSE
        DELETE FROM public.admins WHERE id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_admin_change ON public.profiles;
CREATE TRIGGER on_profile_admin_change
    AFTER INSERT OR UPDATE OF is_admin ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_is_admin_to_table();

-- Ensure all current admins are synced
INSERT INTO public.admins (id)
SELECT id FROM public.profiles WHERE is_admin = true
ON CONFLICT (id) DO NOTHING;


-- =====================================================================
-- 3. RLS POLICIES (Least Privilege)
-- =====================================================================

-- 3.1 compliance_documents
ALTER TABLE public.compliance_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cd_select_own_or_admin" ON public.compliance_documents;
CREATE POLICY "cd_select_own_or_admin" ON public.compliance_documents FOR SELECT USING (
    user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.admins WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "cd_insert_own" ON public.compliance_documents;
CREATE POLICY "cd_insert_own" ON public.compliance_documents FOR INSERT WITH CHECK (
    user_id = auth.uid()
);

-- Allow Admins to UPDATE (Verification) and Users to UPDATE own
DROP POLICY IF EXISTS "cd_update_own_or_admin" ON public.compliance_documents;
CREATE POLICY "cd_update_own_or_admin" ON public.compliance_documents FOR UPDATE 
USING (
    user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.admins WHERE id = auth.uid())
)
WITH CHECK (
    user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.admins WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "cd_delete_own_or_admin" ON public.compliance_documents;
CREATE POLICY "cd_delete_own_or_admin" ON public.compliance_documents FOR DELETE USING (
    user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.admins WHERE id = auth.uid())
);

-- 3.2 subscription_history
ALTER TABLE public.subscription_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sh_select_own_or_admin" ON public.subscription_history;
CREATE POLICY "sh_select_own_or_admin" ON public.subscription_history FOR SELECT USING (
    user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.admins WHERE id = auth.uid())
);

-- 3.3 subscriptions
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sub_select_own_or_admin" ON public.subscriptions;
CREATE POLICY "sub_select_own_or_admin" ON public.subscriptions FOR SELECT USING (
    user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.admins WHERE id = auth.uid())
);

-- 3.4 templates
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tpl_select_auth" ON public.templates;
CREATE POLICY "tpl_select_auth" ON public.templates FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "tpl_manage_admin" ON public.templates;
CREATE POLICY "tpl_manage_admin" ON public.templates FOR ALL USING (
    EXISTS (SELECT 1 FROM public.admins WHERE id = auth.uid())
);

-- 3.5 system_messages
CREATE TABLE IF NOT EXISTS public.system_messages (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    title text NOT NULL,
    message text NOT NULL,
    priority text DEFAULT 'INFO',
    created_at timestamptz DEFAULT now(),
    created_by uuid REFERENCES auth.users(id)
);
ALTER TABLE public.system_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "msg_view_all" ON public.system_messages;
CREATE POLICY "msg_view_all" ON public.system_messages FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "msg_manage_admin" ON public.system_messages;
CREATE POLICY "msg_manage_admin" ON public.system_messages FOR ALL USING (
    EXISTS (SELECT 1 FROM public.admins WHERE id = auth.uid())
);

-- 3.6 user_feedback
CREATE TABLE IF NOT EXISTS public.user_feedback (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id),
    tender_id uuid REFERENCES public.tenders(id),
    rating int,
    message text,
    created_at timestamptz DEFAULT now()
);
ALTER TABLE public.user_feedback ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fb_insert_own" ON public.user_feedback;
CREATE POLICY "fb_insert_own" ON public.user_feedback FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "fb_select_admin" ON public.user_feedback;
CREATE POLICY "fb_select_admin" ON public.user_feedback FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.admins WHERE id = auth.uid())
);

-- 3.7 legal_consents
CREATE TABLE IF NOT EXISTS public.legal_consents (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id),
    version text,
    created_at timestamptz DEFAULT now(),
    UNIQUE(user_id, version)
);
ALTER TABLE public.legal_consents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lc_insert_own" ON public.legal_consents;
CREATE POLICY "lc_insert_own" ON public.legal_consents FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "lc_select_own" ON public.legal_consents;
CREATE POLICY "lc_select_own" ON public.legal_consents FOR SELECT USING (user_id = auth.uid());


-- =====================================================================
-- 4. VIEWS (Compatibility)
-- =====================================================================

-- 4.1 Canonical View for Logic
CREATE OR REPLACE VIEW public.view_compliance_summary AS
SELECT 
    id,
    user_id,
    user_id as profile_id,
    doc_type,
    status,
    expiry_date,
    title,
    category,
    CASE 
        WHEN status = 'expired' OR (expiry_date IS NOT NULL AND expiry_date < CURRENT_DATE) THEN 'expired'
        WHEN expiry_date IS NOT NULL AND expiry_date < (CURRENT_DATE + INTERVAL '30 days') THEN 'warning'
        ELSE 'valid'
    END as computed_status
FROM public.compliance_documents;

-- 4.2 Legacy Compatibility View (Maps old request structure to new table)
CREATE OR REPLACE VIEW public.company_documents AS
SELECT 
    id,
    user_id as profile_id,
    doc_type::public.company_doc_type, -- Cast back if enum needed
    file_url as file_path,
    expiry_date,
    is_verified,
    created_at,
    updated_at
FROM public.compliance_documents;


-- =====================================================================
-- 5. RPC STANDARDISATION (camelCase JSON)
-- =====================================================================

-- 5.1 get_admin_dashboard_snapshot
CREATE OR REPLACE FUNCTION public.get_admin_dashboard_snapshot()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_users int;
    v_active_users int;
    v_total_revenue decimal(10,2);
    v_error_count_24h int;
    v_status text;
    v_snapshot_timestamp bigint;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.admins WHERE id = auth.uid()) THEN RAISE EXCEPTION 'Access Denied'; END IF;

    select count(*) into v_total_users from auth.users;

    select count(*) into v_active_users 
    from auth.users 
    where last_sign_in_at > (now() - interval '30 days')
       or created_at > (now() - interval '30 days');

    select coalesce(sum(amount), 0.00) into v_total_revenue
    from public.subscription_history
    where status = 'paid';

    select count(*) into v_error_count_24h 
    from public.error_logs 
    where severity = 'critical' 
    and created_at > (now() - interval '24 hours');

    if v_error_count_24h > 10 then v_status := 'CRITICAL';
    elsif v_error_count_24h > 0 then v_status := 'DEGRADED';
    else v_status := 'HEALTHY';
    end if;

    v_snapshot_timestamp := extract(epoch from now()) * 1000;

    return json_build_object(
        'totalUsers', v_total_users,
        'activeUsers', v_active_users,
        'lifetimeRevenuePaid', v_total_revenue,
        'systemHealth', json_build_object('status', v_status, 'errorCount24h', v_error_count_24h),
        'snapshotTimestamp', v_snapshot_timestamp
    );
END;
$$;


-- 5.2 get_admin_analytics
CREATE OR REPLACE FUNCTION public.get_admin_analytics()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_mrr decimal;
    v_active_subs int;
    v_total_users int;
    v_perfect_compliance int;
    v_growth_series json;
    v_compliance_split json;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.admins WHERE id = auth.uid()) THEN RAISE EXCEPTION 'Access Denied'; END IF;

    -- Basic Stats
    select coalesce(sum(amount), 0) into v_mrr from public.subscriptions where status = 'active';
    select count(*) into v_active_subs from public.subscriptions where status = 'active';
    select count(*) into v_total_users from auth.users;

    -- Perfect Compliance
    select count(*) into v_perfect_compliance
    from (
        select user_id 
        from public.compliance_documents
        where status = 'valid' 
        group by user_id
        having count(*) >= 5
    ) as valid_users;

    -- Growth Series
    select json_agg(t) into v_growth_series
    from (
        select to_char(date_trunc('month', created_at), 'Mon') as name, count(*) as users
        from auth.users
        where created_at > now() - interval '6 months'
        group by date_trunc('month', created_at)
        order by date_trunc('month', created_at)
    ) t;

    -- Split
    select json_build_object(
        'compliant', v_perfect_compliance,
        'atRisk', v_total_users - v_perfect_compliance
    ) into v_compliance_split;

    -- Return CamelCase
    return json_build_object(
        'mrrActiveSubscriptions', v_mrr,
        'activeSubscriptions', v_active_subs,
        'totalUsers', v_total_users,
        'perfectComplianceUsers', v_perfect_compliance,
        'userGrowthSeries', coalesce(v_growth_series, '[]'::json),
        'complianceSplit', v_compliance_split
    );
END;
$$;


-- 5.3 get_admin_users
DROP FUNCTION IF EXISTS public.get_admin_users();
CREATE OR REPLACE FUNCTION public.get_admin_users()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result json;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.admins WHERE id = auth.uid()) THEN RAISE EXCEPTION 'Access Denied'; END IF;

    SELECT json_agg(row_to_json(t)) INTO result
    FROM (
        SELECT 
            u.id as "id",
            u.email as "email",
            p.company_name as "companyName",
            (p.cidb_grade_grading::text || p.cidb_grade_class) as "cidbGrade",
            p.bbbee_level as "bbbeeLevel",
            u.created_at as "createdAt",
            u.last_sign_in_at as "lastSignInAt",
            (SELECT count(*) FROM public.compliance_documents cd WHERE cd.user_id = u.id) as "docCount",
            coalesce(s.status, 'inactive') as "subStatus",
            coalesce(s.plan_name, 'Free Plan') as "subPlan",
            (SELECT count(*) FROM public.subscription_history sh WHERE sh.user_id = u.id) > 0 as "hasHistory"
        FROM auth.users u
        LEFT JOIN public.profiles p ON u.id = p.id
        LEFT JOIN public.subscriptions s ON s.user_id = u.id
        ORDER BY u.created_at DESC
    ) t;

    RETURN coalesce(result, '[]'::json);
END;
$$;


-- =====================================================================
-- 6. INDEXES (Performance)
-- =====================================================================

CREATE INDEX IF NOT EXISTS idx_compliance_docs_user_expiry ON public.compliance_documents(user_id, expiry_date);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status ON public.subscriptions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_sub_history_status_date ON public.subscription_history(status, created_at);
CREATE INDEX IF NOT EXISTS idx_system_messages_date ON public.system_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_error_logs_severity_date ON public.error_logs(severity, created_at);

COMMIT;
