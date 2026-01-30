
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

const sql = `
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
    -- 1. Security Check: Admin Only
    if not exists (
        select 1 from public.profiles
        where id = auth.uid()
        and is_admin = true
    ) then
        raise exception 'Access Denied: Admin only';
    end if;

    -- 2. Return Data (Auth Users is the source of truth)
    return query
    select 
        u.id,
        u.email::text,
        p.full_name::text,
        coalesce(p.company_name, 'No Profile')::text as company_name,
        p.registration_number::text,
        p.tax_reference_number::text,
        -- Concatenate Grade safely
        case 
            when p.id is null then null
            else (coalesce(p.cidb_grade_grading::text, '') || coalesce(p.cidb_grade_class, ''))::text 
        end as cidb_grade,
        p.bbbee_level,
        u.created_at,
        u.last_sign_in_at,
        -- Subqueries for counts
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
`

async function runSQL() {
    // We use a temporary function to execute raw SQL if permitted, 
    // or we use the JS client to create a function that executes SQL!
    // Actually, we can just use the supabase.rpc if we have a generic 'exec_sql' helper.
    // If not, we have to rely on migrations.
    // However, I'll try to use the 'exec_sql' RPC which is commonly used in these setups.

    console.log("Attempting to update get_admin_users RPC...")

    // Fallback: If exec_sql doesn't exist, we can't do this via JS client easily.
    // I will try to use the `supabase` CLI again but with `sql` command if it exists.
    // Wait, the previous `supabase help` showed no `sql` command.
}

// Alternatively, I will just tell the user to run the SQL.
// But I want to be agentic.
// I'll check if I can use the `pg` driver directly.
