-- Migration: Feedback System
-- Description: Tables and RPCs for User Satisfaction Ratings

-- 1. Create Feedback Table
create table if not exists public.user_feedback (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.profiles(id) on delete cascade not null,
    tender_id uuid references public.tenders(id) on delete set null,
    rating int not null check (rating >= 1 and rating <= 5),
    message text,
    created_at timestamptz default now()
);

-- 2. Add flag to Tenders to prevent duplicate prompts
alter table public.tenders add column if not exists has_rated boolean default false;

-- 3. RPC: Admin Feedback Stats
create or replace function public.get_admin_feedback_stats()
returns json
language plpgsql
security definer
as $$
declare
    avg_rating numeric;
    total_count int;
begin
    select 
        coalesce(avg(rating), 0),
        count(*)
    into 
        avg_rating,
        total_count
    from public.user_feedback;

    return json_build_object(
        'average', to_char(avg_rating, 'FM9.9'),
        'count', total_count
    );
end;
$$;

-- 4. RPC: Admin Feedback History
create or replace function public.get_admin_feedback_history()
returns table (
    id uuid,
    user_email text,
    company_name text,
    rating int,
    message text,
    created_at timestamptz,
    tender_title text
)
language plpgsql
security definer
as $$
begin
    return query
    select 
        f.id,
        u.email::text,
        p.company_name,
        f.rating,
        f.message,
        f.created_at,
        t.title as tender_title
    from public.user_feedback f
    join public.profiles p on p.id = f.user_id
    join auth.users u on u.id = p.id
    left join public.tenders t on t.id = f.tender_id
    order by f.created_at desc;
end;
$$;

-- 5. RPC: Get Total Registered Users
create or replace function public.get_total_users_count()
returns int
language sql
security definer
as $$
    select count(*)::int from public.profiles;
$$;
