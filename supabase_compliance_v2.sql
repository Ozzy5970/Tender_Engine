-- COMPLIANCE ENGINE V2 UPDATE
-- Upgrade the simple table to a robust one.

-- 1. Alter Existing Table (Safely)
-- We add columns instead of dropping to preserve any data (though likely empty)

DO $$ 
BEGIN
    -- Add Category
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='compliance_documents' AND column_name='category') THEN
        ALTER TABLE public.compliance_documents ADD COLUMN category text;
    END IF;

    -- Add Document Type (Specific)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='compliance_documents' AND column_name='doc_type') THEN
        ALTER TABLE public.compliance_documents ADD COLUMN doc_type text;
    END IF;

    -- Add Reference Number (Tax Pin, CRS Num)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='compliance_documents' AND column_name='reference_number') THEN
        ALTER TABLE public.compliance_documents ADD COLUMN reference_number text;
    END IF;

    -- Add Metadata (JSONB for specialized fields like CIDB Grade)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='compliance_documents' AND column_name='metadata') THEN
        ALTER TABLE public.compliance_documents ADD COLUMN metadata jsonb default '{}'::jsonb;
    END IF;

    -- Add Issue Date
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='compliance_documents' AND column_name='issue_date') THEN
        ALTER TABLE public.compliance_documents ADD COLUMN issue_date date;
    END IF;
END $$;

-- 2. Create a "Smart View" for Status
-- This view automatically calculates if a document is 'expired' or 'valid' based on dates.
-- It simplifies the Frontend logic significantly.

CREATE OR REPLACE VIEW public.view_compliance_summary AS
SELECT
    id,
    user_id,
    title,
    category,
    doc_type,
    reference_number,
    expiry_date,
    metadata,
    CASE 
        WHEN expiry_date IS NOT NULL AND expiry_date < CURRENT_DATE THEN 'expired'
        WHEN expiry_date IS NOT NULL AND expiry_date < (CURRENT_DATE + INTERVAL '30 days') THEN 'warning'
        ELSE 'valid'
    END as computed_status
FROM
    public.compliance_documents;

-- 3. Index for performance
CREATE INDEX IF NOT EXISTS idx_compliance_user_category ON public.compliance_documents(user_id, category);
