-- INSPECT RPCS: Security & Dependencies

WITH rpc_info AS (
    SELECT 
        p.oid,
        p.proname as function_name,
        p.prosecdef as is_security_definer, -- true if SECURITY DEFINER
        pg_get_functiondef(p.oid) as definition
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.proname IN ('get_admin_dashboard_snapshot', 'get_admin_analytics', 'get_admin_users')
),
tables_accessed AS (
    -- This is a heuristic text search for table names in the definition since pg_depend doesn't always show dynamic SQL deps
    -- We'll search for specific tables we know are relevant
    SELECT 
        r.function_name,
        t.tablename
    FROM rpc_info r,
    (VALUES 
        ('auth.users'), 
        ('public.subscriptions'), 
        ('public.subscription_history'),
        ('public.profiles'),
        ('public.error_logs'),
        ('public.compliance_documents'),
        ('public.admins')
    ) as t(tablename)
    WHERE r.definition ILIKE '%' || t.tablename || '%'
)
SELECT 
    r.function_name,
    CASE WHEN r.is_security_definer THEN 'YES' ELSE 'NO - DANGER' END as security_definer,
    'Bypasses RLS (Owner context)' as rls_status, -- Security Definer functions run as owner
    string_agg(t.tablename, ', ') as tables_read
FROM rpc_info r
LEFT JOIN tables_accessed t ON t.function_name = r.function_name
GROUP BY r.function_name, r.is_security_definer;

-- Note: 
-- "Bypasses RLS" is true if SECURITY DEFINER is YES.
-- If NO, it runs with the invoker's permissions and RLS policies apply.
