import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function check() {
    console.log("Checking subscriptions table...");
    const { data, error } = await supabase.from('subscriptions').select('*');
    if (error) {
        console.error("Error:", error);
    } else {
        console.log("Count:", data.length);
        if (data.length > 0) {
            console.log("First row:", data[0]);
            console.log("Statuses:", data.map(s => s.status));
        } else {
            console.log("Table is empty");
        }
    }
}

check();
