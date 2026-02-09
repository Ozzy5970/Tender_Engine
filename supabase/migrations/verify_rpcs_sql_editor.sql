-- VERIFY RPCs DIRECTLY IN SQL EDITOR
-- Run this to confirm the backend logic works.

DO $$
DECLARE
    v_is_admin boolean;
    v_snapshot jsonb;
    v_analytics jsonb;
BEGIN
    -- 1. Check is_admin() for the current user (this will be the user running the query, likely you)
    -- NOTE: In SQL Editor, auth.uid() might be null or the owner. 
    -- We can simulate it if needed, but 'postgres' role usually bypasses RLS anyway.
    -- However, the RPCs have `IF NOT public.is_admin() THEN RAISE EXCEPTION 'Access Denied';`
    -- AND `is_admin()` checks `auth.uid()`.
    
    -- So we might fail if we just run it as superuser without setting the user?
    -- Actually, let's see if we can get a result. 
    -- If you are the admin in the `admins` table, we need to mock the session or just invoke the logic.

    RAISE NOTICE '--- STARTING VERIFICATION ---';

    -- 2. Test get_admin_dashboard_snapshot
    -- We'll try to run it. If it fails due to "Access Denied", that proves the Gate is working.
    -- If we want to really test the DATA, we need to temporarily disable the gate or mock the user.
    -- BUT, let's just run it and see if it throws or returns.
    
    BEGIN
        v_snapshot := public.get_admin_dashboard_snapshot();
        RAISE NOTICE 'Snapshot Result: %', v_snapshot;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Snapshot Failed (Expected if not logged in as admin): %', SQLERRM;
    END;

    -- 3. Test get_admin_revenue_ledger
    BEGIN
        PERFORM public.get_admin_revenue_ledger(now() - interval '30 days', now(), 10, 0);
        RAISE NOTICE 'Revenue Ledger ran successfully.';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Revenue Ledger Failed: %', SQLERRM;
    END;
    
    RAISE NOTICE '--- END VERIFICATION ---';
END $$;

-- 4. Check if migration applied (users function exists?)
SELECT 
    routine_name, routines.data_type 
FROM information_schema.routines 
WHERE routine_name = 'get_admin_users'
AND routine_schema = 'public';
