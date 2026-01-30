import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function check() {
    const { data: subs, error } = await supabase.from('subscriptions').select('*');
    if (error) console.error(error);
    else {
        console.log('Subscriptions:', JSON.stringify(subs, null, 2));
        const total = subs?.reduce((acc, s) => acc + (Number(s.amount) || 0), 0)
        console.log('Manual Sum Total Revenue:', total);
    }

    const { data: history, error: historyError } = await supabase.from('subscription_history').select('*');
    if (historyError) console.error('History Error:', historyError);
    else console.log('History Count:', history?.length);
}

check();
