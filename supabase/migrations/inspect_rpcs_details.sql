-- Inspect RPC Definitions
SELECT 
    routine_name,
    data_type as return_type,
    routine_definition,
    external_language,
    security_type,
    created,
    last_altered
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN (
    'get_admin_dashboard_snapshot',
    'get_admin_analytics',
    'get_admin_users',
    'get_admin_revenue_ledger'
);
