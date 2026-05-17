const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data: users, error } = await supabase.auth.admin.listUsers();
  if (error) {
    console.error('Error fetching users:', error);
    return;
  }
  const user = users.users.find(u => u.email && u.email.toLowerCase() === 'austin.simonsps@gmail.com');
  console.log('auth.users exists:', !!user);
  if (user) {
    const id = user.id;
    console.log('User ID:', id);
    const { data: p } = await supabase.from('profiles').select('*').eq('id', id);
    console.log('profiles rows:', p?.length);
    const { data: a } = await supabase.from('admins').select('*').eq('id', id);
    console.log('admins rows:', a?.length);
    console.log('admins data:', a);
    const { data: s } = await supabase.from('subscriptions').select('*').eq('user_id', id);
    console.log('subscriptions rows:', s?.length);
    console.log('subscriptions data:', s);
  }
}
check();
