-- Fix Admin Stats RPC to return camelCase and include error counts
create or replace function get_admin_stats()
returns json
language plpgsql
security definer
as $$
declare
    total_users int;
    total_tenders int;
    total_docs int;
    template_downloads int;
    error_count_24h int;
begin
    select count(*) into total_users from auth.users;
    select count(*) into total_tenders from public.tenders;
    select count(*) into total_docs from public.compliance_documents;
    select coalesce(sum(download_count), 0) into template_downloads from public.templates;
    
    -- Count critical errors in last 24h
    -- Note: Ensure error_logs table exists. If not, this returns 0 silently or fails? 
    -- It should fail if table doesn't exist, but we assume it does based on previous files.
    select count(*) into error_count_24h 
    from public.error_logs 
    where severity = 'critical' 
    and created_at > (now() - interval '24 hours');

    return json_build_object(
        'totalUsers', total_users,
        'totalTenders', total_tenders,
        'totalDocuments', total_docs,
        'templateDownloads', template_downloads,
        'errorCount24h', error_count_24h
    );
end;
$$;
