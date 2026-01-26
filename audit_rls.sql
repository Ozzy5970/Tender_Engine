SELECT 
    schemaname, 
    tablename, 
    policyname, 
    permissive, 
    roles, 
    cmd, 
    qual, 
    with_check 
FROM pg_policies 
WHERE tablename IN ('compliance_documents', 'company_documents', 'tenders', 'profiles');

SELECT tablename, rowsecurity FROM pg_tables 
WHERE tablename IN ('compliance_documents', 'company_documents', 'tenders', 'profiles');
