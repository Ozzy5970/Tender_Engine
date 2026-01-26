-- 1. Temporarily Upgrade YOUR User to Tier 2
update public.profiles 
set tier = 'Tier 2 Pro', company_name = 'Test Company T2'
where id = auth.uid();

-- 2. Send Feedback as Tier 2 (Should trigger email)
insert into public.user_feedback (user_id, rating, message)
values (auth.uid(), 4, 'Test Feedback from Tier 2 (Self)');

-- 3. Upgrade YOUR User to Tier 3
update public.profiles 
set tier = 'Tier 3 Elite', company_name = 'Test Company T3'
where id = auth.uid();

-- 4. Send Feedback as Tier 3 (Should trigger URGENT email)
insert into public.user_feedback (user_id, rating, message)
values (auth.uid(), 5, 'Test Feedback from Tier 3 (Self)');

-- 5. (Optional) Reset your tier back to default? 
-- You might want to keep it high for testing. uncomment to reset:
-- update public.profiles set tier = 'Tier 1' where id = auth.uid();
