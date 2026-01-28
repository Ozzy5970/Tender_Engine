-- CLEANUP SCRIPT (FULL SWEEP - FIXED V2)

-- 1. Delete Error Logs (Orphaned by default)
DELETE FROM public.error_logs
WHERE user_id IN (
    SELECT id FROM auth.users 
    WHERE email IN ('austin.simonsps+test@gmail.com', 'austin.simonsps4@gmail.com')
);

-- 2. Delete Legal Consents (Blocks Deletion)
-- The error showed this table has a restrictive constraints
DELETE FROM public.legal_consents
WHERE user_id IN (
    SELECT id FROM auth.users 
    WHERE email IN ('austin.simonsps+test@gmail.com', 'austin.simonsps4@gmail.com')
);

-- 3. Delete Users (Cascades to Profiles, Tenders, Docs, Subscriptions, Feedback)
DELETE FROM auth.users
WHERE email IN (
  'austin.simonsps+test@gmail.com',
  'austin.simonsps4@gmail.com'
);

-- 4. Patch Admin View (Ensure robust LEFT JOIN for future user visibility)
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

    -- 2. Return Joined Data (Updated to LEFT JOIN for safety)
    return query
    select 
        u.id,
        u.email::text,
        coalesce(p.company_name, 'No Profile')::text as company_name,
        case 
            when p.id is null then null
            else (p.cidb_grade_grading || p.cidb_grade_class)::text 
        end as cidb_grade,
        p.bbbee_level,
        u.created_at,
        u.last_sign_in_at,
        (select count(*) from public.company_documents cd where cd.profile_id = u.id) as doc_count,
        coalesce(s.status, 'free')::text as sub_status,
        coalesce(s.plan_name, 'Free Plan')::text as sub_plan,
        (select count(*) from public.subscription_history sh where sh.user_id = u.id) > 0 as has_history
    from auth.users u
    left join public.profiles p on u.id = p.id
    left join public.subscriptions s on s.user_id = u.id
    order by u.created_at desc;
end;
$$;
