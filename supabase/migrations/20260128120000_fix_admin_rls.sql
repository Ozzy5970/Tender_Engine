-- Migration: Fix Admin RLS Access
-- Description: Allow admins to view all profiles (required for error logs and user management)

-- 1. Profiles Policy (View All if Admin)
-- Note: 'profiles_select_own' already exists. We add a potentially overlapping permissive policy.
-- Postgres RLS combines "permissive" policies with OR.
create policy "Admins can view all profiles"
on public.profiles for select
using (
    exists (
        select 1 from public.profiles
        where id = auth.uid()
        and is_admin = true
    )
);

-- 2. Error Logs (Double check, although it looked fine, ensure admins can DELETE too to clean up)
create policy "Admins can delete errors"
on public.error_logs for delete
using (
    exists (
        select 1 from public.profiles
        where id = auth.uid()
        and is_admin = true
    )
);
