DO $$
DECLARE
    target_user_id uuid;
BEGIN
    -- 1. Get User ID
    SELECT id INTO target_user_id FROM auth.users WHERE email = 'austin.simonsps@gmail.com';

    IF target_user_id IS NULL THEN
        RAISE NOTICE 'User not found!';
        RETURN;
    END IF;

    -- 2. Ensure Profile Exists
    INSERT INTO public.profiles (id, company_name)
    VALUES (target_user_id, 'Admin User')
    ON CONFLICT (id) DO NOTHING;

    -- 3. Set Admin
    UPDATE public.profiles
    SET is_admin = true
    WHERE id = target_user_id;

    RAISE NOTICE 'User % promoted to Admin', target_user_id;
END $$;
