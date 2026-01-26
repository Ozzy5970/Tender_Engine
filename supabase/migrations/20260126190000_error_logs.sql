-- Migration: Error Logging System
-- Description: Table for capturing frontend/system errors

create table if not exists public.error_logs (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.profiles(id) on delete set null,
    page text,
    description text,
    stack_trace text,
    severity text check (severity in ('critical', 'warning', 'info')),
    created_at timestamptz default now()
);

-- RPC for Admin Dashboard Stats (Errors in last 24h)
create or replace function public.get_error_stats()
returns json
language plpgsql
security definer
as $$
declare
    critical_count int;
    total_count int;
begin
    select count(*) into total_count from public.error_logs;
    
    select count(*) into critical_count 
    from public.error_logs 
    where severity = 'critical' 
    and created_at > (now() - interval '24 hours');

    return json_build_object(
        'critical_24h', critical_count,
        'total', total_count
    );
end;
$$;

-- Allow public insert (for capturing errors even if auth fails, ideally shielded but for now public is needed for pre-auth errors)
-- OR restrict to authenticated if we prefer. Let's start with authenticated + anon if needed.
alter table public.error_logs enable row level security;

create policy "Users can insert errors" on public.error_logs
    for insert with check (true);

create policy "Admins can view errors" on public.error_logs
    for select using (
        exists (
            select 1 from public.profiles
            where id = auth.uid() and is_admin = true
        )
    );
