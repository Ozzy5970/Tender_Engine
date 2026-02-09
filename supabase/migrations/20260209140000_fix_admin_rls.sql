-- Migration: 20260209140000_fix_admin_rls.sql
-- Description: Fix RLS recursion in admins table and standardize profiles policies.

-- 1. Create Helper Function (Bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.admins a WHERE a.id = auth.uid());
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- 2. Fix Admins Table RLS (Remove Recursion)
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

-- Drop existing policies involved in recursion
DROP POLICY IF EXISTS "admins_read_policy" ON public.admins;
DROP POLICY IF EXISTS "Public read for admins table" ON public.admins;
DROP POLICY IF EXISTS "Admins can view all admins" ON public.admins;
DROP POLICY IF EXISTS "Users can view own admin status" ON public.admins;

-- Create simple, non-recursive policy
CREATE POLICY "admins_select_self_only"
ON public.admins FOR SELECT TO authenticated
USING (auth.uid() = id);

-- Note: Management of admins table (INSERT/DELETE) should be restricted to service_role or specific constrained policies if needed. 
-- For now, letting self-read is enough for is_admin() checks if someone queries table directly, 
-- but is_admin() function BYPASSES this anyway.

-- 3. Standardize Profiles Policies
-- Drop potential duplicates/conflicting policies
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_final" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles; -- Common name
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles; -- If exists

-- Create ONE clean SELECT policy
CREATE POLICY "profiles_select_own_or_admin"
ON public.profiles FOR SELECT TO authenticated
USING (
    auth.uid() = id 
    OR 
    public.is_admin() -- Uses security definer function, no recursion
);

-- Fix UPDATE policies
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_final" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

CREATE POLICY "profiles_update_own_or_admin"
ON public.profiles FOR UPDATE TO authenticated
USING (auth.uid() = id OR public.is_admin())
WITH CHECK (auth.uid() = id OR public.is_admin());

-- Ensure INSERT policy exists (usually authenticated users can insert their own profile)
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;

CREATE POLICY "profiles_insert_own"
ON public.profiles FOR INSERT TO authenticated
WITH CHECK (auth.uid() = id);

-- 4. Fix Subscriptions RLS (Likely has recursion too if it checks admins table directly)
DROP POLICY IF EXISTS "Admins can view all subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can view own subscription" ON public.subscriptions;

CREATE POLICY "subscriptions_select_own_or_admin"
ON public.subscriptions FOR SELECT TO authenticated
USING (
    user_id = auth.uid() 
    OR 
    public.is_admin()
);

-- 5. Fix Subscription History RLS
DROP POLICY IF EXISTS "Admins can view all history" ON public.subscription_history;
DROP POLICY IF EXISTS "Users can view own history" ON public.subscription_history;

CREATE POLICY "history_select_own_or_admin"
ON public.subscription_history FOR SELECT TO authenticated
USING (
    user_id = auth.uid() 
    OR 
    public.is_admin()
);
