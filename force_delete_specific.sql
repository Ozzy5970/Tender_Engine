-- FORCE DELETE SCRIPT (V2 - Fixed Legal Consents)
-- Target: austin.simonsps+test1@gmail.com

DO $$
DECLARE
    target_email text := 'austin.simonsps+test1@gmail.com';
    target_user_id uuid;
BEGIN
    -- 1. Find User ID
    SELECT id INTO target_user_id FROM auth.users WHERE email = target_email;

    IF target_user_id IS NULL THEN
        RAISE NOTICE 'User % not found, nothing to delete.', target_email;
        RETURN;
    END IF;

    RAISE NOTICE 'Deleting User: % (ID: %)', target_email, target_user_id;

    -- 2. Delete Dependencies (Child Tables)
    -- We delete in specific order to avoid FK constraints
    
    -- Level 5 (Deepest)
    DELETE FROM public.compliance_checks WHERE tender_id IN (SELECT id FROM public.tenders WHERE user_id = target_user_id);
    DELETE FROM public.compliance_requirements WHERE tender_id IN (SELECT id FROM public.tenders WHERE user_id = target_user_id);
    DELETE FROM public.tender_documents WHERE tender_id IN (SELECT id FROM public.tenders WHERE user_id = target_user_id);
    DELETE FROM public.ai_drafts WHERE tender_id IN (SELECT id FROM public.tenders WHERE user_id = target_user_id);

    -- Level 4
    DELETE FROM public.tenders WHERE user_id = target_user_id;

    -- Level 3 (Direct User Links)
    DELETE FROM public.company_documents WHERE profile_id = target_user_id;
    DELETE FROM public.subscriptions WHERE user_id = target_user_id;
    DELETE FROM public.subscription_history WHERE user_id = target_user_id;
    DELETE FROM public.error_logs WHERE user_id = target_user_id;
    DELETE FROM public.alerts WHERE user_id = target_user_id;
    DELETE FROM public.audit_logs WHERE actor_id = target_user_id;
    DELETE FROM public.user_feedback WHERE user_id = target_user_id;
    
    -- The one that failed previously:
    DELETE FROM public.legal_consents WHERE user_id = target_user_id;

    -- Level 2 (Profile)
    DELETE FROM public.profiles WHERE id = target_user_id;

    -- Level 1 (Auth User)
    DELETE FROM auth.users WHERE id = target_user_id;

    RAISE NOTICE 'Deletion Complete for %', target_email;
END $$;
