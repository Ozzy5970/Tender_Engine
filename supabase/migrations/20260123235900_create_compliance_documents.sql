-- Migration: Create Compliance Documents Table and View (Restored)
-- Description: Creates the table and view required by later migrations

-- 1. Create Table with ALL columns (merging schema.sql and v2 update)
CREATE TABLE IF NOT EXISTS public.compliance_documents (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  title text not null,
  status text check (status in ('valid', 'warning', 'missing')) default 'missing',
  expiry_date date,
  file_name text,
  file_url text,
  created_at timestamp with time zone default now(),
  
  -- V2 columns
  category text,
  doc_type text,
  reference_number text,
  metadata jsonb default '{}'::jsonb,
  issue_date date
);

-- Enable RLS
ALTER TABLE public.compliance_documents ENABLE ROW LEVEL SECURITY;

-- 2. Create the View (required by 20260124000500_secure_view.sql)
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

-- 3. Index
CREATE INDEX IF NOT EXISTS idx_compliance_user_category ON public.compliance_documents(user_id, category);
