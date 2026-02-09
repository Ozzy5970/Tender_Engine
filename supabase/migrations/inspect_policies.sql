-- Inspect Policies on public.admins and public.profiles
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM
    pg_policies
WHERE
    tablename IN ('admins', 'profiles')
ORDER BY
    tablename, policyname;
