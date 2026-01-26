-- Test Script: Verify Tier 2 and Tier 3 Logic (Robust)
-- Uses a real user from your database instead of auth.uid() which can be null in the editor.

do $$
declare
    target_user_id uuid;
begin
    -- 1. Grab ANY valid user to test with
    select id into target_user_id from public.profiles limit 1;

    -- Safety check
    if target_user_id is null then
        raise exception 'No users found in profiles table! Please sign up a user in the app first.';
    end if;

    -- 2. Upgrade User to Tier 2
    update public.profiles 
    set tier = 'Tier 2 Pro', company_name = 'Test Company T2'
    where id = target_user_id;

    -- 3. Send Feedback as Tier 2 (Expect: Standard Email)
    insert into public.user_feedback (user_id, rating, message)
    values (target_user_id, 4, 'Test Feedback from Tier 2 (Scripted)');

    -- 4. Upgrade User to Tier 3
    update public.profiles 
    set tier = 'Tier 3 Elite', company_name = 'Test Company T3'
    where id = target_user_id;

    -- 5. Send Feedback as Tier 3 (Expect: URGENT Email)
    insert into public.user_feedback (user_id, rating, message)
    values (target_user_id, 5, 'Test Feedback from Tier 3 (Scripted)');
    
    -- 6. (Optional) Reset to Tier 1
    -- update public.profiles set tier = 'Tier 1' where id = target_user_id;
    
end $$;
