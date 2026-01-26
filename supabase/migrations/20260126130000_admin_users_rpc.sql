-- Migration: Create Admin Users RPC
-- Description: Function to fetch detailed user list for Admin Dashboard.

create or replace function public.get_admin_users()
returns table (
    id uuid,
    email text,
    company_name text,
    cidb_grade text,
    bbbee_level int,
    created_at timestamptz,
    last_sign_in_at timestamptz,
    doc_count bigint,
    sub_status text,
    sub_plan text,
    has_history boolean
)
language plpgsql
security definer
as $$
begin
    -- 1. Security Check: Ensure caller is Admin
    if not exists (
        select 1 from public.profiles
        where id = auth.uid()
        and is_admin = true
    ) then
        raise exception 'Access Denied: Admin only';
    end if;

    -- 2. Return Joined Data
    return query
    select 
        p.id,
        u.email::text, -- Cast to text to ensure compatibility
        p.company_name,
        (p.cidb_grade_grading || p.cidb_grade_class)::text as cidb_grade,
        p.bbbee_level,
        u.created_at,
        u.last_sign_in_at,
        (select count(*) from public.company_documents cd where cd.profile_id = p.id) as doc_count,
        -- Subscription Info
        coalesce(s.status, 'free')::text as sub_status,
        coalesce(s.plan_name, 'Free Plan')::text as sub_plan,
        -- Check if they ever paid (History > 0)
        (select count(*) from public.subscription_history sh where sh.user_id = p.id) > 0 as has_history
    from public.profiles p
    join auth.users u on u.id = p.id
    left join public.subscriptions s on s.user_id = p.id
    order by u.created_at desc;
end;
$$;
