SELECT
  n.nspname AS schema,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS args,
  r.rolname AS grantee,
  has_function_privilege(r.rolname, p.oid, 'EXECUTE') AS can_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
CROSS JOIN pg_roles r
WHERE n.nspname = 'public'
  AND p.proname = 'log_system_error'
  AND r.rolname IN ('anon', 'authenticated', 'postgres')
ORDER BY r.rolname;

SELECT public.log_system_error(
  'test', 'rpc dedupe test error', null, 'warning', 'test_dedupe_fingerprint', '{"third_call": true}'::jsonb
);
