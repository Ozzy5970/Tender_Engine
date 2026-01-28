import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function debugData() {
    console.log('--- Checking Auth Users ---');
    const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();
    if (authError) return console.error(authError);
    console.log(`Found ${users.length} users.`);

    console.log('\n--- Checking Profiles ---');
    const { data: profiles, error: profileError } = await supabase.from('profiles').select('id, company_name, is_admin');
    if (profileError) return console.error(profileError);
    console.log(`Found ${profiles.length} profiles.`);

    console.log('\n--- Checking Subscriptions ---');
    const { data: subs, error: subError } = await supabase.from('subscriptions').select('user_id, status, plan_name');
    if (subError) return console.error(subError);
    console.log(`Found ${subs.length} subscriptions.`);

    console.log('\n--- Analysis ---');
    for (const u of users) {
        const p = profiles.find(p => p.id === u.id);
        const s = subs.find(s => s.user_id === u.id);

        console.log(`User: ${u.email}`);
        console.log(`  Profile: ${p ? 'OK (' + p.company_name + ')' : 'MISSING!'}`);
        console.log(`  Admin: ${p?.is_admin ? 'YES' : 'NO'}`);
        console.log(`  Sub: ${s ? 'OK (' + s.status + ')' : 'NONE'}`);

        if (!p) {
            console.log('  -> FIX NEEDED: Profile missing');
        }
    }
}

debugData();
