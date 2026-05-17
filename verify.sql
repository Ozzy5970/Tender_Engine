-- Verify columns
SELECT column_name, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'error_logs'
  AND column_name IN (
    'status', 'seen_at', 'seen_by', 'resolved_at', 'resolved_by',
    'ignored_at', 'ignored_by', 'updated_at', 'last_seen_at',
    'occurrence_count', 'fingerprint', 'metadata'
  )
ORDER BY column_name;

-- Verify RPC exists
SELECT proname FROM pg_proc WHERE proname = 'log_system_error';

-- Verify legacy insert
INSERT INTO public.error_logs (description, severity)
VALUES ('Legacy insert compatibility test', 'warning')
RETURNING id, status, occurrence_count, metadata;

-- Verify RPC Dedupe
SELECT public.log_system_error(
  'test', 'rpc dedupe test error', null, 'warning', 'test_dedupe_fingerprint', '{"test": true}'::jsonb
) AS first_id;

SELECT public.log_system_error(
  'test', 'rpc dedupe test error', null, 'warning', 'test_dedupe_fingerprint', '{"second_call": true}'::jsonb
) AS second_id;

SELECT id, occurrence_count, metadata, status, last_seen_at
FROM public.error_logs
WHERE fingerprint = 'test_dedupe_fingerprint';

-- Verify anon grant is NOT present
SELECT grantee, privilege_type 
FROM information_schema.routine_privileges 
WHERE routine_name = 'log_system_error';

-- Verify Health RPCs run without crashing
SELECT public.get_error_stats();
-- Admin Dashboard RPC requires an admin to call it, but we can verify it exists.
-- Calling it natively might fail due to "Access Denied" because we are postgres superuser, but auth.uid() is null and is_admin will be false. Let's try.
SELECT public.get_admin_dashboard_snapshot();
