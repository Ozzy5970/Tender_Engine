-- Clean up Tenders for Admin User
-- User requested removal of "old test data" (tenders) from their view.

DO $$
DECLARE
    target_email text := 'austin.simonsps@gmail.com';
    target_uid uuid;
BEGIN
    -- Get User ID
    select id into target_uid from auth.users where email = target_email;

    IF target_uid IS NOT NULL THEN
        -- Delete Tenders (Cascades to documents, checks, drafts)
        delete from public.tenders where user_id = target_uid;
        
        -- Optional: Clean up alerts related to these tenders (orphaned ones might remain if set null)
        delete from public.alerts where user_id = target_uid; 
        
        RAISE NOTICE 'Cleaned up tenders and alerts for user %', target_email;
    ELSE
        RAISE NOTICE 'User % not found', target_email;
    END IF;
END $$;
