
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

const sql = `
-- 1. Update RPC to include last_seen_at
create or replace function public.get_admin_users()
returns table (
    id uuid,
    email text,
    full_name text,
    company_name text,
    registration_number text,
    tax_reference_number text,
    cidb_grade text,
    bbbee_level int,
    created_at timestamptz,
    last_sign_in_at timestamptz,
    last_seen_at timestamptz,
    doc_count bigint,
    sub_status text,
    sub_plan text,
    has_history boolean,
    profile_complete boolean
)
language plpgsql
security definer
as $$
begin
    if not exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.is_admin = true) then
        raise exception 'Access Denied';
    end if;

    return query
    select 
        u.id,
        u.email::text,
        p.full_name::text,
        coalesce(p.company_name, 'No Profile')::text as company_name,
        p.registration_number::text,
        p.tax_reference_number::text,
        case 
            when p.id is null then null
            else (coalesce(p.cidb_grade_grading::text, '') || coalesce(p.cidb_grade_class, ''))::text 
        end as cidb_grade,
        p.bbbee_level,
        u.created_at,
        u.last_sign_in_at,
        p.updated_at as last_seen_at,
        (select count(*) from public.company_documents cd where cd.profile_id = u.id) as doc_count,
        coalesce(s.status, 'free')::text as sub_status,
        coalesce(s.plan_name, 'Free Plan')::text as sub_plan,
        (select count(*) from public.subscription_history sh where sh.user_id = u.id) > 0 as has_history,
        (
            p.full_name is not null and 
            p.company_name is not null and p.company_name != 'New Company' and
            p.registration_number is not null and
            p.tax_reference_number is not null
        ) as profile_complete
    from auth.users u
    left join public.profiles p on u.id = p.id
    left join public.subscriptions s on s.user_id = u.id
    order by u.created_at desc;
end;
$$;

-- 2. POPIA compliant RLS for admins
drop policy if exists "admins_view_all_subscriptions" on public.subscriptions;
create policy "admins_view_all_subscriptions" on public.subscriptions
    for select using (
        exists (
            select 1 from public.profiles
            where profiles.id = auth.uid()
            and profiles.is_admin = true
        )
    );

drop policy if exists "admins_view_all_history" on public.subscription_history;
create policy "admins_view_all_history" on public.subscription_history
    for select using (
        exists (
            select 1 from public.profiles
            where profiles.id = auth.uid()
            and profiles.is_admin = true
        )
    );

-- Profiles visibility
drop policy if exists "admins_view_all_profiles" on public.profiles;
create policy "admins_view_all_profiles" on public.profiles
    for select using (
        exists (
            select 1 from public.profiles admin
            where admin.id = auth.uid()
            and admin.is_admin = true
        )
    );
`

async function run() {
    console.log('Sending SQL to Supabase...')
    // Note: This relies on the exec_sql RPC being present if using JS client for raw SQL
    // If not, the user has to run it. I will try to use the CLI with a file.
}

run()
