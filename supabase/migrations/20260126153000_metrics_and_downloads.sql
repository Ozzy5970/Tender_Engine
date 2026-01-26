-- Migration: Metrics and Downloads Fixes
-- Description: Adds template download tracking and fixes analytics compliance logic.

-- 1. Create increment_template_download RPC
create or replace function public.increment_template_download(template_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  update public.templates
  set download_count = coalesce(download_count, 0) + 1
  where id = template_id;
end;
$$;

-- 2. Update get_admin_analytics RPC with Correct Compliance Logic (9 Docs)
create or replace function get_admin_analytics()
returns json
language plpgsql
security definer
as $$
declare
    total_revenue decimal;
    active_subs int;
    total_users_count int;
    perfect_compliance_users int;
    total_tenders_count int;
    growth_data json;
    compliance_data json;
begin
    -- Security Check
    if not exists (select 1 from public.profiles where id = auth.uid() and is_admin = true) then
        raise exception 'Access Denied';
    end if;

    -- Basic Stats
    select coalesce(sum(amount), 0) into total_revenue from public.subscriptions where status = 'active';
    select count(*) into active_subs from public.subscriptions where status = 'active';
    select count(*) into total_users_count from auth.users;
    
    -- New: Total Tenders Count
    select count(*) into total_tenders_count from public.tenders;

    -- Update: "Perfect Compliance" now requires >= 9 valid documents
    select count(*) into perfect_compliance_users
    from (
        select profile_id 
        from public.company_documents 
        where status = 'valid' 
        group by profile_id 
        having count(*) >= 9
    ) as valid_users;

    -- Growth Data (Last 6 Months User Signups)
    select json_agg(t) into growth_data
    from (
        select 
            to_char(date_trunc('month', created_at), 'Mon') as name,
            count(*) as users
        from auth.users
        where created_at > now() - interval '6 months'
        group by date_trunc('month', created_at)
        order by date_trunc('month', created_at)
    ) t;

    -- Compliance Health (Breakdown)
    select json_build_object(
        'compliant', perfect_compliance_users,
        'at_risk', total_users_count - perfect_compliance_users
    ) into compliance_data;

    return json_build_object(
        'revenue', total_revenue,
        'active_subscriptions', active_subs,
        'total_users', total_users_count,
        'total_tenders', total_tenders_count,
        'perfect_score', perfect_compliance_users,
        'user_growth', coalesce(growth_data, '[]'::json),
        'compliance_split', compliance_data
    );
end;
$$;
