-- Add missing UPDATE policy for error logs
-- Using the inline exists check because public.is_admin() does not exist in this database yet.

CREATE POLICY "Admins can update errors" 
ON public.error_logs 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() AND profiles.is_admin = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() AND profiles.is_admin = true
  )
);
