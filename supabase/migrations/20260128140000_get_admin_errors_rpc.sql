-- Migration: Get Admin Errors RPC
-- Description: Fetch error logs with user email (from auth.users) and company name. 
-- Fixes 400 Error where frontend tried to fetch non-existent 'email' column from profiles table.

create or replace function public.get_admin_errors()
returns json
language plpgsql
security definer
as $$
declare
    result json;
begin
    -- Security Check: Admin Only
    if not exists (select 1 from public.profiles where id = auth.uid() and is_admin = true) then
        raise exception 'Access Denied';
    end if;

    select json_agg(t) into result
    from (
        select 
            e.id,
            e.created_at,
            e.page,
            e.description,
            e.stack_trace,
            e.severity,
            e.user_id,
            u.email,
            p.company_name
        from public.error_logs e
        left join auth.users u on e.user_id = u.id
        left join public.profiles p on e.user_id = p.id
        order by e.created_at desc
        limit 1000
    ) t;

    return coalesce(result, '[]'::json);
end;
$$;
