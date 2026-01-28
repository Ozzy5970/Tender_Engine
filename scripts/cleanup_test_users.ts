import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
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

const TEST_EMAILS = [
    'austin.simonsps+test1@gmail.com'
];

async function cleanupUsers() {
    console.log('Starting cleanup of test users...');

    try {
        const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();

        if (listError) {
            console.error('Error listing users:', listError);
            return;
        }

        for (const email of TEST_EMAILS) {
            const user = users.find(u => u.email === email);

            if (user) {
                console.log(`Deleting user: ${email} (${user.id})`);

                // Delete from Auth (Cascades to public.profiles/subscriptions usually if set up, but we'll see)
                const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);

                if (deleteError) {
                    console.error(`  Error deleting user ${email}:`, deleteError.message);
                } else {
                    console.log(`  Successfully deleted ${email}`);
                }
            } else {
                console.log(`User not found: ${email}`);
            }
        }

        console.log('Cleanup complete.');

    } catch (err) {
        console.error('Unexpected error:', err);
    }
}

cleanupUsers();
