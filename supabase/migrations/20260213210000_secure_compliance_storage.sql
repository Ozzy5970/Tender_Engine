
BEGIN;

-- 1. Add Storage Columns to compliance_documents
ALTER TABLE public.compliance_documents 
ADD COLUMN IF NOT EXISTS storage_path text,
ADD COLUMN IF NOT EXISTS bucket text DEFAULT 'compliance';

-- 2. Backfill existing data
-- Current file_url IS the valid storage path in the 'compliance' bucket based on current logic
UPDATE public.compliance_documents 
SET storage_path = file_url, 
    bucket = 'compliance' 
WHERE storage_path IS NULL AND file_url IS NOT NULL;

-- 3. Add Index for performance on lookups
CREATE INDEX IF NOT EXISTS idx_compliance_storage ON public.compliance_documents(user_id, storage_path);

-- 4. Update Canonical View to expose new columns
DROP VIEW IF EXISTS public.view_compliance_summary;
CREATE OR REPLACE VIEW public.view_compliance_summary AS
SELECT 
    id,
    user_id,
    user_id as profile_id,
    doc_type,
    status,
    expiry_date,
    title,
    category,
    storage_path, -- NEW
    bucket,       -- NEW
    file_url,     -- Retained for legacy compatibility
    CASE 
        WHEN status = 'expired' OR (expiry_date IS NOT NULL AND expiry_date < CURRENT_DATE) THEN 'expired'
        WHEN expiry_date IS NOT NULL AND expiry_date < (CURRENT_DATE + INTERVAL '30 days') THEN 'warning'
        ELSE 'valid'
    END as computed_status
FROM public.compliance_documents;

-- 5. Secure Deletion RPC
-- Atomically deletes the DB row and returns the storage path for client cleanup
CREATE OR REPLACE FUNCTION public.delete_compliance_document(p_doc_id uuid)
RETURNS TABLE (storage_path text, bucket text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_path text;
    v_bucket text;
BEGIN
    -- Verify ownership via matching user_id (or checking admin status)
    RETURN QUERY 
    DELETE FROM public.compliance_documents
    WHERE id = p_doc_id
    AND (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.admins WHERE id = auth.uid()))
    RETURNING compliance_documents.storage_path, compliance_documents.bucket;
END;
$$;

COMMIT;
