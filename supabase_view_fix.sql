-- FIX: Show only LATEST document per type
-- We MUST drop the view first because we are changing the column structure (adding file_url/file_name)

DROP VIEW IF EXISTS public.view_compliance_summary;

CREATE VIEW public.view_compliance_summary AS
SELECT DISTINCT ON (user_id, doc_type)
    id,
    user_id,
    title,
    category,
    doc_type,
    reference_number,
    expiry_date,
    metadata,
    file_url,
    file_name,
    created_at, -- Ensure this column exists in compliance_documents. If not, use issue_date or updated_at
    CASE 
        WHEN expiry_date IS NOT NULL AND expiry_date < CURRENT_DATE THEN 'expired'
        WHEN expiry_date IS NOT NULL AND expiry_date < (CURRENT_DATE + INTERVAL '30 days') THEN 'warning'
        ELSE 'valid'
    END as computed_status
FROM
    public.compliance_documents
ORDER BY
    user_id, doc_type, created_at DESC;
