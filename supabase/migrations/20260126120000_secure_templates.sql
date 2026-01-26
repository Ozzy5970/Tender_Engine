-- Migration: Secure Templates Table
-- Description: Revokes generic write access and enforces Admin-only management.

-- 1. Drop existing loose policies
DROP POLICY IF EXISTS "Authenticated users manage templates" ON public.templates;
DROP POLICY IF EXISTS "Admins can manage templates" ON public.templates;
DROP POLICY IF EXISTS "Everyone can view templates" ON public.templates;

-- 2. View Policy (Authenticated Users can READ)
CREATE POLICY "Authenticated users view templates"
ON public.templates FOR SELECT
TO authenticated
USING (true);

-- 3. Management Policy (Admins Only)
-- Requires 'is_admin' column on profiles table (created in previous migration)
CREATE POLICY "Admins manage templates"
ON public.templates FOR ALL
TO authenticated
USING (
    exists (
        select 1 from public.profiles
        where id = auth.uid()
        and is_admin = true
    )
);

-- 4. Storage Security (Templates Bucket)
DROP POLICY IF EXISTS "Admin Upload Templates" ON storage.objects;

CREATE POLICY "Admins manage template files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'templates' AND
    exists (
        select 1 from public.profiles
        where id = auth.uid()
        and is_admin = true
    )
);

DROP POLICY IF EXISTS "Admin Delete Templates" ON storage.objects;

CREATE POLICY "Admins delete template files"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'templates' AND
    exists (
        select 1 from public.profiles
        where id = auth.uid()
        and is_admin = true
    )
);
