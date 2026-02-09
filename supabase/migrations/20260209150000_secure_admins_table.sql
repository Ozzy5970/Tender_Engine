-- Migration: 20260209150000_secure_admins_table.sql
-- Description: Lock down public.admins table. Disable RLS, Revoke Permissions per user request.

-- 1. Revoke All Permissions (Make it internal only)
REVOKE ALL ON TABLE public.admins FROM anon;
REVOKE ALL ON TABLE public.admins FROM authenticated;
-- Note: service_role and postgres (superuser) still have access.

-- 2. Drop all policies (Clean slate)
DROP POLICY IF EXISTS "admins_read_policy" ON public.admins;
DROP POLICY IF EXISTS "Public read for admins table" ON public.admins;
DROP POLICY IF EXISTS "Admins can view all admins" ON public.admins;
DROP POLICY IF EXISTS "Users can view own admin status" ON public.admins;
DROP POLICY IF EXISTS "admins_select_self_only" ON public.admins;

-- 3. Disable RLS (No longer needed since permissions are revoked)
-- This avoids any recursion overhead for internal queries / security definer functions
ALTER TABLE public.admins DISABLE ROW LEVEL SECURITY;

-- 4. Ensure Austin is Admin (Bootstrap)
INSERT INTO public.admins (id)
SELECT id FROM auth.users WHERE email = 'austin.simonsps@gmail.com'
ON CONFLICT (id) DO NOTHING;
