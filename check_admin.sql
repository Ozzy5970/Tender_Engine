select u.email, p.company_name, p.is_admin 
from auth.users u
join public.profiles p on u.id = p.id
where u.email = 'austin.simonsps@gmail.com';
