-- MANUAL SUBSCRIPTION GRANT SCRIPT
-- Usage: Run this in Supabase SQL Editor.
-- Change the 'target_email' and 'plan_name' variables below to whatever you need.

DO $$
DECLARE
    -- INPUTS: Change these for each "purchase"
    target_email text := 'austin.simonsps@gmail.com'; -- The friend's email
    wanted_plan text := 'Enterprise';                 -- 'Standard' or 'Enterprise'
    
    -- Variables (Do not change)
    target_uid uuid;
    price decimal;
BEGIN
    -- 1. Get User ID
    SELECT id INTO target_uid FROM auth.users WHERE email = target_email;

    IF target_uid IS NULL THEN
        RAISE NOTICE 'User % not found. Have they signed up yet?', target_email;
        RETURN;
    END IF;

    -- 2. Determine Price (for Admin Dashboard Stats)
    IF wanted_plan = 'Enterprise' THEN
        price := 1999.00;
    ELSIF wanted_plan = 'Standard' THEN
        price := 499.00;
    ELSE
        price := 0.00;
    END IF;

    RAISE NOTICE 'Granting % Plan to % (ID: %)', wanted_plan, target_email, target_uid;

    -- 3. Upsert Subscription (Active)
    -- This enables the features in the app immediately.
    INSERT INTO public.subscriptions (user_id, plan_name, amount, status, updated_at)
    VALUES (target_uid, wanted_plan, price, 'active', now())
    ON CONFLICT (user_id) 
    DO UPDATE SET 
        plan_name = EXCLUDED.plan_name,
        amount = EXCLUDED.amount,
        status = 'active',
        updated_at = now();

    -- 4. Record Transaction History (For Revenue Charts)
    -- This makes sure your Admin Dashboard shows the money.
    INSERT INTO public.subscription_history (user_id, plan_name, amount, status, created_at)
    VALUES (target_uid, wanted_plan, price, 'paid', now());

    RAISE NOTICE 'Success! % is now on % plan.', target_email, wanted_plan;
END $$;
