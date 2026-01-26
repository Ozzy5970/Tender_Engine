
-- Grant Admin Access to Owner
-- This runs on the remote database to update the specific user profile.
-- Using DO block to safely handle logic.

DO $$
DECLARE
    target_user_id uuid;
BEGIN
    -- Find the user ID from auth.users (requires superuser privileges which migrations have)
    SELECT id INTO target_user_id
    FROM auth.users
    WHERE email = 'austin.simonsps@gmail.com';

    -- If user exists, update their profile
    IF target_user_id IS NOT NULL THEN
        UPDATE public.profiles
        SET is_admin = true
        WHERE id = target_user_id;

        -- Create the profile if it doesn't exist for some reason (fail-safe)
        -- INSERT INTO public.profiles (id, is_admin)
        -- VALUES (target_user_id, true)
        -- ON CONFLICT (id) DO UPDATE SET is_admin = true;
    END IF;
END $$;
