
-- 1. Subscriptions Admin Policy
create policy "admins_view_all_subscriptions" on public.subscriptions
    for select using (
        exists (
            select 1 from public.profiles
            where profiles.id = auth.uid()
            and profiles.is_admin = true
        )
    );

-- 2. History Admin Policy
create policy "admins_view_all_history" on public.subscription_history
    for select using (
        exists (
            select 1 from public.profiles
            where profiles.id = auth.uid()
            and profiles.is_admin = true
        )
    );
