
-- ==========================================
-- EMERGENCY WEBSITE RECOVERY: RLS KILLSWITCH
-- ==========================================

-- 1. DISABLE RLS TEMPORARILY
-- This immediately unblocks the 'profiles' table cache
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_history DISABLE ROW LEVEL SECURITY;

-- 2. DROP ALL POTENTIAL RECURSIVE POLICIES
DROP POLICY IF EXISTS "admins_view_all_profiles" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_self_access" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_access" ON public.profiles;

DROP POLICY IF EXISTS "admins_view_all_subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "admins_view_all_history" ON public.subscription_history;

-- 3. APPLY SIMPLE, NON-RECURSIVE SECURITY
-- Users can only see their own data. No function calls. No recursion.

-- Profiles
CREATE POLICY "profiles_recovery_v1" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

-- Subscriptions
CREATE POLICY "subs_recovery_v1" ON public.subscriptions
    FOR SELECT USING (user_id = auth.uid());

-- History
CREATE POLICY "history_recovery_v1" ON public.subscription_history
    FOR SELECT USING (user_id = auth.uid());

-- 4. RE-ENABLE RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_history ENABLE ROW LEVEL SECURITY;

-- 5. TRASH THE LOOPING FUNCTION
DROP FUNCTION IF EXISTS public.check_is_admin();
