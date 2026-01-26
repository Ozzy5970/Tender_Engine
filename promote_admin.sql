update public.profiles
set is_admin = true
where id = (
  select id from auth.users where email = 'austin.simonsps@gmail.com'
);
