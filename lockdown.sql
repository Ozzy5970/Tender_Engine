-- DATA ISOLATION LOCKDOWN
-- Run this to fix "Leakage" where users see each other's data.

-- 1. FORCE ENABLE RLS (Row Level Security)
-- If this was "false", that explains why everyone saw everything.
ALTER TABLE public.compliance_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. CLEANUP: Drop all existing loose policies to start fresh
DROP POLICY IF EXISTS "company_docs_access_own" ON public.company_documents;
DROP POLICY IF EXISTS "tenders_access_own" ON public.tenders;
DROP POLICY IF EXISTS "Users can view own tenders" ON public.tenders;
DROP POLICY IF EXISTS "Users can insert own tenders" ON public.tenders;
DROP POLICY IF EXISTS "Users can update own tenders" ON public.tenders;
DROP POLICY IF EXISTS "Users can delete own tenders" ON public.tenders;

-- Drop policies for compliance_documents
DROP POLICY IF EXISTS "Users can view own compliance docs" ON public.compliance_documents;
DROP POLICY IF EXISTS "Users can insert own compliance docs" ON public.compliance_documents;
DROP POLICY IF EXISTS "Users can update own compliance docs" ON public.compliance_documents;
DROP POLICY IF EXISTS "Users can delete own compliance docs" ON public.compliance_documents;

-- 3. APPLY STRICT "OWNER ONLY" RULES

-- TENDERS
CREATE POLICY "Strict Access: Tenders"
ON public.tenders
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- COMPLIANCE DOCUMENTS
CREATE POLICY "Strict Access: Compliance Docs"
ON public.compliance_documents
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- PROFILES
-- Users can see their own profile, Admins can see everyone
DROP POLICY IF EXISTS "Profiles are viewable by users who created them." ON public.profiles;
CREATE POLICY "Strict Access: Profiles"
ON public.profiles
FOR ALL
USING (
    auth.uid() = id -- Own Profile
    OR 
    (SELECT is_admin FROM public.profiles WHERE id = auth.uid()) = true -- Admin Access
);

-- 4. VERIFICATION MSG
DO $$
BEGIN
    RAISE NOTICE 'RLS Lockdown Complete. Data is now isolated.';
END $$;
