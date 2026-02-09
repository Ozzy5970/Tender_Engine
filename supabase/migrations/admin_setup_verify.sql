-- Admin Verification Script
-- Impersonates 'austin.simonsps@gmail.com' to test Admin RPCs.

DO $$
DECLARE
    v_admin_email text := 'austin.simonsps@gmail.com';
    v_admin_uid uuid;
    v_result json;
BEGIN
    -- 1. Find User
    SELECT id INTO v_admin_uid FROM auth.users WHERE email = v_admin_email;
    
    IF v_admin_uid IS NULL THEN
        RAISE EXCEPTION 'User % not found in auth.users', v_admin_email;
    END IF;

    RAISE NOTICE 'Found Admin UID: %', v_admin_uid;

    -- 2. Ensure in public.admins
    INSERT INTO public.admins (id) VALUES (v_admin_uid)
    ON CONFLICT (id) DO NOTHING;

    -- 3. Impersonate (Set JWT Context)
    -- This mimics a request from the authenticated user
    PERFORM set_config('request.jwt.claims', 
        json_build_object(
            'sub', v_admin_uid,
            'role', 'authenticated',
            'email', v_admin_email
        )::text, 
        true
    );
    -- Also set role for RLS
    PERFORM set_config('role', 'authenticated', true);

    RAISE NOTICE '--- Testing get_admin_dashboard_snapshot ---';
    SELECT public.get_admin_dashboard_snapshot() INTO v_result;
    RAISE NOTICE 'Snapshot: %', v_result;

    RAISE NOTICE '--- Testing get_admin_revenue_ledger ---';
    SELECT public.get_admin_revenue_ledger(
        now() - interval '365 days',
        now(),
        10,
        0
    ) INTO v_result;
    RAISE NOTICE 'Ledger (First 10): %', v_result;

END $$;
