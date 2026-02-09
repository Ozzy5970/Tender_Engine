-- Security Audit Script
-- Inspects RLS status, Policies, and Security Definer functions for key tables.

WITH target_tables AS (
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename IN (
        'profiles', 'admins', 'subscriptions', 'subscription_history', 
        'compliance_documents', 'system_messages', 'user_feedback', 'error_logs'
    )
),
rls_status AS (
    SELECT 
        c.relname as tablename,
        c.relrowsecurity as rls_enabled,
        c.relforcerowsecurity as rls_forced
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
    AND c.relname IN (SELECT tablename FROM target_tables)
),
policies AS (
    SELECT 
        tablename,
        policyname,
        cmd,
        qual,
        with_check
    FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename IN (SELECT tablename FROM target_tables)
),
sec_def_funcs AS (
    SELECT 
        p.proname as function_name,
        pg_get_functiondef(p.oid) as definition
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.prosecdef = true -- Security Definer only
    AND (
        -- Simple heuristic: check if function body mentions target tables
        pg_get_functiondef(p.oid) ILIKE '%profiles%' OR
        pg_get_functiondef(p.oid) ILIKE '%admins%' OR
        pg_get_functiondef(p.oid) ILIKE '%subscriptions%' OR
        pg_get_functiondef(p.oid) ILIKE '%compliance_documents%' OR
        pg_get_functiondef(p.oid) ILIKE '%error_logs%'
    )
)
SELECT 
    'TABLE_STATUS' as type,
    json_agg(rls_status) as data
FROM rls_status
UNION ALL
SELECT 
    'POLICIES' as type,
    json_agg(policies) as data
FROM policies
UNION ALL
SELECT 
    'SEC_DEF_FUNCS' as type,
    json_agg(json_build_object('name', function_name)) as data
FROM sec_def_funcs;
