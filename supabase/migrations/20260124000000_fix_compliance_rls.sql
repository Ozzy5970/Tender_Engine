-- Migration: Fix Compliance RLS for Table and Storage
-- Description: Unblocks upload of compliance documents by fixing RLS policies

-- 1. FIX COMPLIANCE_DOCUMENTS TABLE RLS
-----------------------------------------
ALTER TABLE IF EXISTS public.compliance_documents ENABLE ROW LEVEL SECURITY;

-- Drop generic/old policies to ensure clean slate
DROP POLICY IF EXISTS "Users can view own compliance docs" ON public.compliance_documents;
DROP POLICY IF EXISTS "Users can update own compliance docs" ON public.compliance_documents;
DROP POLICY IF EXISTS "Users can insert own compliance docs" ON public.compliance_documents;
DROP POLICY IF EXISTS "Users can delete own compliance docs" ON public.compliance_documents;

-- Re-create policies
CREATE POLICY "Users can view own compliance docs" 
  ON public.compliance_documents FOR SELECT 
  USING ( auth.uid() = user_id );

CREATE POLICY "Users can insert own compliance docs" 
  ON public.compliance_documents FOR INSERT 
  WITH CHECK ( auth.uid() = user_id );

CREATE POLICY "Users can update own compliance docs" 
  ON public.compliance_documents FOR UPDATE 
  USING ( auth.uid() = user_id );

CREATE POLICY "Users can delete own compliance docs" 
  ON public.compliance_documents FOR DELETE 
  USING ( auth.uid() = user_id );


-- 2. FIX STORAGE RLS (Bucket: 'compliance')
---------------------------------------------
-- Ensure bucket exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('compliance', 'compliance', false)
ON CONFLICT (id) DO NOTHING;

-- Policies for storage.objects
-- Note: We must use a unique name specifically for this bucket to avoid conflicts

DROP POLICY IF EXISTS "Compliance Images Upload" ON storage.objects;
DROP POLICY IF EXISTS "Compliance Images Select" ON storage.objects;
DROP POLICY IF EXISTS "Compliance Images Update" ON storage.objects;
DROP POLICY IF EXISTS "Compliance Images Delete" ON storage.objects;

-- Allow authenticated users to upload files to "compliance" bucket
-- (We constrain to auth.uid() ownership if possible, or just allow auth users)
CREATE POLICY "Compliance Images Upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'compliance' AND auth.role() = 'authenticated' );

-- Allow users to view their own files (or all files in compliance bucket if they are authenticated?)
-- Tighter security: only view what you uploaded (owner = auth.uid())
CREATE POLICY "Compliance Images Select"
ON storage.objects FOR SELECT
TO authenticated
USING ( bucket_id = 'compliance' AND owner = auth.uid() );

-- Allow users to update their own files
CREATE POLICY "Compliance Images Update"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'compliance' AND owner = auth.uid() );

-- Allow users to delete their own files
CREATE POLICY "Compliance Images Delete"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'compliance' AND owner = auth.uid() );
