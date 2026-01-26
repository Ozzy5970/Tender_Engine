-- CRITICAL FIX: Add missing INSERT policy for compliance documents
-- Before this, users could resolve (UPDATE) but not create (INSERT) new docs.

-- 1. Drop existing policies to be safe (prevent conflicts)
DROP POLICY IF EXISTS "Users can insert own compliance docs" ON public.compliance_documents;

-- 2. Create the missing policy
CREATE POLICY "Users can insert own compliance docs" 
ON public.compliance_documents 
FOR INSERT 
WITH CHECK ( auth.uid() = user_id );

-- 3. Ensure UPDATE policy is broad enough covers all columns
DROP POLICY IF EXISTS "Users can update own compliance docs" ON public.compliance_documents;

CREATE POLICY "Users can update own compliance docs" 
ON public.compliance_documents 
FOR UPDATE 
USING ( auth.uid() = user_id );

-- 4. Ensure SELECT is still there
-- (Already exists in base schema, but confirming)
-- CREATE POLICY "Users can view own compliance docs" ... (skipped to avoid duplicate error)
