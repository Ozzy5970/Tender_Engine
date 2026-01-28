-- CLEAN ADMIN TEST DATA
-- Purpose: Remove all application data (tenders, docs, logs, alerts) for the Admin 
--          but PRESERVE the Account, Profile, Subscription, and Legal Consents.

DO $$
DECLARE
    target_email text := 'austin.simonsps@gmail.com';
    target_uid uuid;
BEGIN
    -- 1. Find User ID
    SELECT id INTO target_uid FROM auth.users WHERE email = target_email;

    IF target_uid IS NULL THEN
        RAISE NOTICE 'User % not found.', target_email;
        RETURN;
    END IF;

    RAISE NOTICE 'Cleaning data for User: % (ID: %)', target_email, target_uid;

    -- 2. Delete Application Data

    -- Tenders (Cascades to tender_documents, compliance_checks, compliance_requirements, ai_drafts)
    DELETE FROM public.tenders WHERE user_id = target_uid;

    -- Company Documents (Uploaded files)
    DELETE FROM public.company_documents WHERE profile_id = target_uid;

    -- Alerts
    DELETE FROM public.alerts WHERE user_id = target_uid;

    -- Error Logs (Your testing errors)
    DELETE FROM public.error_logs WHERE user_id = target_uid;

    -- Audit Logs (Your history of actions)
    DELETE FROM public.audit_logs WHERE actor_id = target_uid;

    -- User Feedback (Any feedback submitted)
    DELETE FROM public.user_feedback WHERE user_id = target_uid;

    RAISE NOTICE 'Data cleanup complete. Account and Subscription preserved.';
END $$;
