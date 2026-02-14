-- 20260214120000_compliance_storage_policies.sql
-- Forcefully secure the 'compliance' bucket and enforce user-specific paths.

-- 1. Ensure the bucket exists and is PRIVATE
DO $$
BEGIN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('compliance', 'compliance', false)
    ON CONFLICT (id) DO UPDATE
    SET public = false;
END $$;

-- 2. Enable RLS on storage.objects (Standard Security Practice)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies for "compliance" bucket to ensure idempotency
-- We drop by name to avoid conflicts if they exist.
DROP POLICY IF EXISTS "Compliance Docs Insert 1" ON storage.objects;
DROP POLICY IF EXISTS "Compliance Docs Select 1" ON storage.objects;
DROP POLICY IF EXISTS "Compliance Docs Delete 1" ON storage.objects;
DROP POLICY IF EXISTS "Compliance Docs Update 1" ON storage.objects;
DROP POLICY IF EXISTS "Give users access to own folder 1u74u_0" ON storage.objects;
DROP POLICY IF EXISTS "Give users access to own folder 1u74u_1" ON storage.objects;
DROP POLICY IF EXISTS "Give users access to own folder 1u74u_2" ON storage.objects;
DROP POLICY IF EXISTS "Give users access to own folder 1u74u_3" ON storage.objects;

-- 4. Create Strictpolicies

-- INSERT: Authenticated users can upload ONLY to their own folder: uid/category/doctype/filename
-- Validates that the first path segment matches the user's UUID
CREATE POLICY "Compliance Docs Insert 1"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'compliance' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- SELECT: Users can view their own; Admins can view all
-- Validates that the first path segment matches the user's UUID OR the user is an admin
CREATE POLICY "Compliance Docs Select 1"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'compliance' AND (
    (storage.foldername(name))[1] = auth.uid()::text 
    OR 
    EXISTS (SELECT 1 FROM public.admins WHERE id = auth.uid())
  )
);

-- DELETE: Users can delete their own; Admins can delete all
CREATE POLICY "Compliance Docs Delete 1"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'compliance' AND (
    (storage.foldername(name))[1] = auth.uid()::text 
    OR 
    EXISTS (SELECT 1 FROM public.admins WHERE id = auth.uid())
  )
);

-- UPDATE: Admins Only (Users shouldn't modify history, they replace/delete)
-- This blocks regular users from overwriting files via Update, enforcing immutability except for deletions.
CREATE POLICY "Compliance Docs Update 1"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'compliance' AND 
  EXISTS (SELECT 1 FROM public.admins WHERE id = auth.uid())
)
WITH CHECK (
  bucket_id = 'compliance' AND 
  EXISTS (SELECT 1 FROM public.admins WHERE id = auth.uid())
);
