-- Relax RLS for Templates to allow the current user to upload without 'is_admin' flag setup
DROP POLICY IF EXISTS "Admins can manage templates" ON public.templates;

CREATE POLICY "Authenticated users manage templates"
ON public.templates
FOR ALL
USING (auth.role() = 'authenticated');
