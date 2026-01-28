import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function check() {
    const { data, error } = await supabase.from('subscriptions').select('*');
    if (error) console.error(error);
    else console.log('Subscriptions:', data);

    const { data: analytics, error: rpcError } = await supabase.rpc('get_admin_analytics');
    if (rpcError) console.error('RPC Error:', rpcError);
    else console.log('Analytics:', analytics);
}

check();
