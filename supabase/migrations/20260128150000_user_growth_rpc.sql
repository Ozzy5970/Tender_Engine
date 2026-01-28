-- Migration: User Growth Analytics RPC
-- Description: Dynamic aggregation for User Growth chart (Daily, Weekly, Monthly)

create or replace function public.get_user_growth(period text default 'monthly')
returns json
language plpgsql
security definer
as $$
declare
    result json;
    start_date timestamptz;
    trunc_type text;
    format_str text;
begin
    -- Security Check
    if not exists (select 1 from public.profiles where id = auth.uid() and is_admin = true) then
        raise exception 'Access Denied';
    end if;

    -- Configuration based on period
    if period = 'daily' then
        start_date := now() - interval '30 days';
        trunc_type := 'day';
        format_str := 'DD Mon';      -- e.g., 28 Jan
    elsif period = 'weekly' then
        start_date := now() - interval '12 weeks';
        trunc_type := 'week';
        format_str := 'DD Mon';      -- e.g., 26 Jan (Start of week)
    else -- monthly
        start_date := now() - interval '12 months';
        trunc_type := 'month';
        format_str := 'Mon YY';      -- e.g., Jan 26
    end if;

    select json_agg(t) into result
    from (
        select 
            to_char(date_trunc(trunc_type, created_at), format_str) as name,
            count(*) as users
        from auth.users
        where created_at >= start_date
        group by date_trunc(trunc_type, created_at)
        order by date_trunc(trunc_type, created_at) asc
    ) t;

    return coalesce(result, '[]'::json);
end;
$$;
