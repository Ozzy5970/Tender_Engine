-- CLEANUP SCRIPT (FIXED)
-- Purpose: Remove test data (errors, alerts, feedback) and ensure Admin access.

-- 1. Clear Error Logs (Removes the "21 errors" from dashboard)
TRUNCATE TABLE public.error_logs;

-- 2. Clear System Broadcasts
TRUNCATE TABLE public.system_messages;

-- 3. Clear User Feedback
TRUNCATE TABLE public.user_feedback;

-- 4. Clear Alerts
TRUNCATE TABLE public.alerts;

-- 5. Ensure Admin Access for Austin
-- We look up the UUID from auth.users since profiles table uses that as PK but doesn't store email.
UPDATE public.profiles
SET is_admin = true
WHERE id = (
    SELECT id 
    FROM auth.users 
    WHERE email = 'austin.simonsps@gmail.com'
    LIMIT 1
);

-- 6. Reset Subscription for Admin
UPDATE public.subscriptions
SET status = 'active', 
    plan_name = 'Enterprise Plan', 
    cancel_at_period_end = false
WHERE user_id = (
    SELECT id 
    FROM auth.users 
    WHERE email = 'austin.simonsps@gmail.com'
    LIMIT 1
);
