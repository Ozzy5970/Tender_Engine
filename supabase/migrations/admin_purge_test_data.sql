-- SAFE DELETION SCRIPT: REMOVE NON-ADMIN USERS AND DATA
-- TARGET: Remove EVERYTHING for all users EXCEPT 'austin.simonsps@gmail.com'
-- (Correcting potential typo in request: 'austin.simonsps@gmail.co' -> 'austin.simonsps@gmail.com')

BEGIN;

DO $$
DECLARE
    v_admin_email text := 'austin.simonsps@gmail.com';
    v_admin_id uuid;
    v_count_users int;
    v_count_profiles int;
    v_count_subs int;
    v_count_sub_hist int;
    v_count_comp_docs int;
    v_count_tenders int;
    v_count_feedback int;
    v_count_legal int;
    v_count_alerts int;
    v_count_audit int;
    v_count_errors int;
    v_count_ai_drafts int;
    v_revenue_check decimal;
BEGIN

    -- 1. IDENTIFY ADMIN
    SELECT id INTO v_admin_id FROM auth.users WHERE email = v_admin_email;

    IF v_admin_id IS NULL THEN
        RAISE EXCEPTION 'Admin user % not found! Aborting safely.', v_admin_email;
    END IF;

    RAISE NOTICE 'Preserving Admin ID: % (%)', v_admin_id, v_admin_email;

    -- 2. DRY RUN / COUNT ESTIMATES (What WOULD be deleted)
    -- Select count of users to be deleted
    SELECT count(*) INTO v_count_users FROM auth.users WHERE id != v_admin_id;
    
    -- Child Tables (Approximate counts based on user_id if column exists)
    
    -- Profiles
    SELECT count(*) INTO v_count_profiles FROM public.profiles WHERE id != v_admin_id;
    
    -- Compliance Documents
    SELECT count(*) INTO v_count_comp_docs FROM public.compliance_documents WHERE user_id != v_admin_id;
    
    -- Subscriptions
    SELECT count(*) INTO v_count_subs FROM public.subscriptions WHERE user_id != v_admin_id;
    
    -- Subscription History
    SELECT count(*) INTO v_count_sub_hist FROM public.subscription_history WHERE user_id != v_admin_id;

    -- Tenders (Assuming user_id exists)
    -- Check if table exists first to avoid error in dry run if not strict
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tenders' AND table_schema = 'public') THEN
        EXECUTE 'SELECT count(*) FROM public.tenders WHERE user_id != $1' INTO v_count_tenders USING v_admin_id;
    ELSE
        v_count_tenders := 0;
    END IF;

    -- User Feedback
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_feedback' AND table_schema = 'public') THEN
        EXECUTE 'SELECT count(*) FROM public.user_feedback WHERE user_id != $1' INTO v_count_feedback USING v_admin_id;
    ELSE 
        v_count_feedback := 0;
    END IF;

    -- Legal Consents
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'legal_consents' AND table_schema = 'public') THEN
        EXECUTE 'SELECT count(*) FROM public.legal_consents WHERE user_id != $1' INTO v_count_legal USING v_admin_id;
    ELSE
        v_count_legal := 0;
    END IF;

    -- Alerts (assuming table exists)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'alerts' AND table_schema = 'public') THEN
        EXECUTE 'SELECT count(*) FROM public.alerts WHERE user_id != $1' INTO v_count_alerts USING v_admin_id;
    ELSE
        v_count_alerts := 0;
    END IF;

     -- Audit Logs (assuming table exists)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs' AND table_schema = 'public') THEN
        EXECUTE 'SELECT count(*) FROM public.audit_logs WHERE user_id != $1' INTO v_count_audit USING v_admin_id;
    ELSE
        v_count_audit := 0;
    END IF;
    
    -- Error Logs (assuming table exists)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'error_logs' AND table_schema = 'public') THEN
        EXECUTE 'SELECT count(*) FROM public.error_logs WHERE user_id != $1' INTO v_count_errors USING v_admin_id;
    ELSE
        v_count_errors := 0;
    END IF;

    -- AI Drafts (assuming table exists)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_drafts' AND table_schema = 'public') THEN
        EXECUTE 'SELECT count(*) FROM public.ai_drafts WHERE user_id != $1' INTO v_count_ai_drafts USING v_admin_id;
    ELSE
        v_count_ai_drafts := 0;
    END IF;


    RAISE NOTICE '--- DRY RUN SUMMARY ---';
    RAISE NOTICE 'Users to delete: %', v_count_users;
    RAISE NOTICE 'Profiles to delete: %', v_count_profiles;
    RAISE NOTICE 'Compliance Docs to delete: %', v_count_comp_docs;
    RAISE NOTICE 'Subscriptions to delete: %', v_count_subs;
    RAISE NOTICE 'History to delete: %', v_count_sub_hist;
    RAISE NOTICE 'Tenders to delete: %', v_count_tenders;
    RAISE NOTICE 'Feedback to delete: %', v_count_feedback;
    RAISE NOTICE 'Legal Consents to delete: %', v_count_legal;
    RAISE NOTICE 'Alerts to delete: %', v_count_alerts;
    RAISE NOTICE 'Audit Logs to delete: %', v_count_audit;
    RAISE NOTICE 'Error Logs to delete: %', v_count_errors;
    RAISE NOTICE 'AI Drafts to delete: %', v_count_ai_drafts;
    RAISE NOTICE '-----------------------';

    
    -- 3. EXECUTE DELETION (Dependant Tables First)
    
    -- A. Tables referencing users directly (Child tables)
    
    -- Compliance Documents
    DELETE FROM public.compliance_documents WHERE user_id != v_admin_id;
    
    -- Subscription History (Leftover revenue rows)
    DELETE FROM public.subscription_history WHERE user_id != v_admin_id;
    
    -- Subscriptions
    DELETE FROM public.subscriptions WHERE user_id != v_admin_id;
    
    -- Tenders
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tenders' AND table_schema = 'public') THEN
        EXECUTE 'DELETE FROM public.tenders WHERE user_id != $1' USING v_admin_id;
    END IF;

    -- User Feedback
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_feedback' AND table_schema = 'public') THEN
        EXECUTE 'DELETE FROM public.user_feedback WHERE user_id != $1' USING v_admin_id;
    END IF;

    -- Legal Consents
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'legal_consents' AND table_schema = 'public') THEN
        EXECUTE 'DELETE FROM public.legal_consents WHERE user_id != $1' USING v_admin_id;
    END IF;
    
    -- Alerts
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'alerts' AND table_schema = 'public') THEN
        EXECUTE 'DELETE FROM public.alerts WHERE user_id != $1' USING v_admin_id;
    END IF;

    -- Audit Logs
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs' AND table_schema = 'public') THEN
        EXECUTE 'DELETE FROM public.audit_logs WHERE user_id != $1' USING v_admin_id;
    END IF;

    -- Error Logs
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'error_logs' AND table_schema = 'public') THEN
        EXECUTE 'DELETE FROM public.error_logs WHERE user_id != $1' USING v_admin_id;
    END IF;

    -- AI Drafts
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_drafts' AND table_schema = 'public') THEN
        EXECUTE 'DELETE FROM public.ai_drafts WHERE user_id != $1' USING v_admin_id;
    END IF;

    -- System Messages (Created by others? Or maybe keeping system messages? Assuming created_by column)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'system_messages' AND table_schema = 'public') THEN
         -- Maybe don't delete system messages unless user specific? 
         -- Typically system messages are global. If they have 'created_by', we only delete if created by non-admin?
         -- Skipping strictly to avoid deleting admin messages. 
         -- If there are user-specific messages (e.g. directed AT a user), that schema is different.
         -- Based on migration, system_messages has 'created_by'. We keep them if they are useful, but let's delete strictly non-admin created ones if that's the goal.
         EXECUTE 'DELETE FROM public.system_messages WHERE created_by != $1' USING v_admin_id;
    END IF;

    -- B. Profiles (One-to-One with users)
    DELETE FROM public.profiles WHERE id != v_admin_id;

    -- C. Auth Users (Root)
    DELETE FROM auth.users WHERE id != v_admin_id;

    
    -- 4. VERIFICATION
    SELECT count(*) INTO v_count_users FROM auth.users;
    SELECT coalesce(sum(amount), 0) INTO v_revenue_check FROM public.subscription_history WHERE status = 'paid';
    
    RAISE NOTICE '--- FINAL VERIFICATION ---';
    RAISE NOTICE 'Remaining Users (Should be 1): %', v_count_users;
    RAISE NOTICE 'Remaining Revenue (Admin only): %', v_revenue_check;
    RAISE NOTICE '--------------------------';

END $$;

COMMIT;

-- 5. Final external checks
SELECT count(*) as "Remaining Users" FROM auth.users;
SELECT * FROM public.admins;
SELECT id, email, created_at FROM auth.users;
SELECT coalesce(sum(amount),0) as "Total Revenue" FROM public.subscription_history WHERE status='paid';


-- OPTIONAL SECTION: RESET REVENUE BUT KEEP USERS (Commented Out)
/*
BEGIN;
    -- Only clear history and subscriptions for non-admins, but keep the user accounts
    DELETE FROM public.subscription_history 
    WHERE user_id != (SELECT id FROM auth.users WHERE email = 'austin.simonsps@gmail.com');

    DELETE FROM public.subscriptions 
    WHERE user_id != (SELECT id FROM auth.users WHERE email = 'austin.simonsps@gmail.com');
    
    UPDATE public.profiles
    SET tier = 'free'
    WHERE id != (SELECT id FROM auth.users WHERE email = 'austin.simonsps@gmail.com');

COMMIT;
*/
