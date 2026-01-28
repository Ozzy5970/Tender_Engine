import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
// IMPORTANT: Use Service Role Key to bypass RLS and manage users
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});

const TEST_USERS = [
    {
        email: 'tier1@test.com',
        password: 'password123',
        company_name: 'Tier 1 Construction',
        plan: 'tier-1', // Match your plan naming convention (e.g. Basic, Pro, etc. or tier-1)
        status: 'active'
    },
    {
        email: 'tier2@test.com',
        password: 'password123',
        company_name: 'Tier 2 Civil Works',
        plan: 'tier-2',
        status: 'active'
    },
    {
        email: 'tier3@test.com',
        password: 'password123',
        company_name: 'Tier 3 Enterprise',
        plan: 'tier-3',
        status: 'active'
    }
];

async function seedUsers() {
    console.log('Starting user seeding...');

    try {
        // 1. Ensure subscriptions table exists (basic check)
        const { error: tableCheckError } = await supabase
            .from('subscriptions')
            .select('count')
            .limit(1);

        if (tableCheckError) {
            console.warn('Warning: Could not access subscriptions table. It might not exist or RLS is blocking even service role (unlikely).');
            console.error(tableCheckError);
            // Proceeding might fail, but let's try.
        }

        for (const user of TEST_USERS) {
            console.log(`Processing ${user.email}...`);

            // 2. Create or Get User
            let userId = '';

            // Try to get user by email first (Admin API)
            const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
            if (listError) throw listError;

            const existingUser = users.find(u => u.email === user.email);

            if (existingUser) {
                console.log(`  User exists. ID: ${existingUser.id}`);
                userId = existingUser.id;
                // Optional: Update password
                const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
                    password: user.password,
                    user_metadata: { company_name: user.company_name }
                });
                if (updateError) console.error(`  Error updating password: ${updateError.message}`);
            } else {
                console.log(`  Creating new user...`);
                const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
                    email: user.email,
                    password: user.password,
                    email_confirm: true,
                    user_metadata: { company_name: user.company_name }
                });

                if (createError) {
                    console.error(`  Error creating user: ${createError.message}`);
                    continue;
                }
                userId = newUser.user.id;
                console.log(`  Created. ID: ${userId}`);
            }

            // 3. Update Profile (Company Name)
            // Trigger handles creation, but we update to be sure
            const { error: profileError } = await supabase
                .from('profiles')
                .update({ company_name: user.company_name })
                .eq('id', userId);

            if (profileError) {
                console.error(`  Error updating profile: ${profileError.message}`);
            }

            // 4. Update/Insert Subscription
            // Check if subscription exists
            const { data: existingSub, error: subFetchError } = await supabase
                .from('subscriptions')
                .select('*')
                .eq('user_id', userId)
                .single();

            // Ignore "Row not found" error (code PGRST116)

            const subData = {
                user_id: userId,
                plan_name: user.plan,
                status: user.status,
                amount: 0.00, // Free/Test
                updated_at: new Date().toISOString()
            };

            if (existingSub) {
                console.log(`  Updating existing subscription to ${user.plan}...`);
                const { error: subUpdateError } = await supabase
                    .from('subscriptions')
                    .update(subData)
                    .eq('user_id', userId);

                if (subUpdateError) console.error(`  Error updating subscription: ${subUpdateError.message}`);
            } else {
                console.log(`  Creating new subscription ${user.plan}...`);
                const { error: subInsertError } = await supabase
                    .from('subscriptions')
                    .insert(subData);

                if (subInsertError) console.error(`  Error inserting subscription: ${subInsertError.message}`);
            }
        }

        console.log('Seeding complete!');

    } catch (err) {
        console.error('Unexpected error:', err);
    }
}

seedUsers();
