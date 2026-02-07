-- Migration: Standardize Admin Analytics RPC
-- Description: Update get_admin_analytics to return canonical snake_case fields for admin contract.

create or replace function get_admin_analytics()
returns json
language plpgsql
security definer
as $$
declare
    v_mrr_active_subscriptions decimal;
    v_active_subscriptions int;
    v_total_users int;
    v_perfect_compliance_users int;
    v_growth_series json;
    v_compliance_split json;
begin
    -- Security Check
    if not exists (select 1 from public.profiles where id = auth.uid() and is_admin = true) then
        raise exception 'Access Denied';
    end if;

    -- Basic Stats
    select coalesce(sum(amount), 0) into v_mrr_active_subscriptions from public.subscriptions where status = 'active';
    select count(*) into v_active_subscriptions from public.subscriptions where status = 'active';
    select count(*) into v_total_users from auth.users;

    -- Approximate "Perfect Compliance" (Users with >= 5 valid documents)
    select count(*) into v_perfect_compliance_users
    from (
        select profile_id 
        from public.company_documents 
        where status = 'valid' 
        group by profile_id 
        having count(*) >= 5
    ) as valid_users;

    -- Growth Data (Last 6 Months User Signups)
    select json_agg(t) into v_growth_series
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
        'compliant', v_perfect_compliance_users,
        'at_risk', v_total_users - v_perfect_compliance_users
    ) into v_compliance_split;

    return json_build_object(
        'mrr_active_subscriptions', v_mrr_active_subscriptions,
        'active_subscriptions', v_active_subscriptions,
        'total_users', v_total_users,
        'perfect_compliance_users', v_perfect_compliance_users,
        'user_growth_series', coalesce(v_growth_series, '[]'::json),
        'compliance_split', v_compliance_split
    );
end;
$$;
