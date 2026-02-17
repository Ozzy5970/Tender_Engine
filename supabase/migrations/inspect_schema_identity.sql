
-- Inspect 'company_documents' columns
SELECT 
    'company_documents' as table_name,
    column_name, 
    data_type 
FROM information_schema.columns 
WHERE table_name = 'company_documents';

-- Inspect 'compliance_documents' columns
SELECT 
    'compliance_documents' as table_name,
    column_name, 
    data_type 
FROM information_schema.columns 
WHERE table_name = 'compliance_documents';

-- Inspect 'profiles' columns (for verification/tier fields)
SELECT 
    'profiles' as table_name,
    column_name, 
    data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles' AND column_name IN ('id', 'is_admin', 'profile_complete', 'registration_number', 'tax_reference_number');

-- Inspect 'subscriptions' columns (for tier)
SELECT 
    'subscriptions' as table_name,
    column_name, 
    data_type 
FROM information_schema.columns 
WHERE table_name = 'subscriptions';
