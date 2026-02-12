
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Load env from root
const envPath = path.resolve(__dirname, '../.env');
const envConfig = dotenv.parse(fs.readFileSync(envPath));

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || envConfig.SUPABASE_URL || envConfig.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || envConfig.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function run() {
    // --- 1. SIMULATE get_admin_dashboard_snapshot ---

    // A. Total Users
    // Using profiles as proxy for users since auth.users access via client is Ltd
    const { count: totalUsers } = await supabase.from('profiles').select('*', { count: 'exact', head: true });

    // B. Active Users (Approximate: Profiles created > 30d ago? No, can't check login easily without admin API)
    // We'll just use a heuristic or 0 if we can't get auth.
    // Actually, let's use auth.admin.listUsers() since we have service role!
    const { data: { users } } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const activeUsers = users.filter(u =>
        (u.last_sign_in_at && new Date(u.last_sign_in_at) > thirtyDaysAgo) ||
        (u.created_at && new Date(u.created_at) > thirtyDaysAgo)
    ).length;

    // C. Revenue 30d (Paid)
    // "sum of amount from subscription_history where status = 'paid'"
    // But we need lifetime I think? Wait, RPC said "revenue30dPaid" but logic was "All time"?
    // Let's check RPC code again. 
    // Step 115: select sum(amount) from public.subscription_history where status = 'paid'. 
    // It does NOT filter by date! It is TOTAL REVENUE. 
    // But the key is `revenueLast30Days` (or `revenue30dPaid` in new frontend). The RPC var is `v_total_revenue`.
    // It seems the RPC calculates TOTAL revenue but calls it revenue30dPaid? Or maybe I misread.
    // Step 115 line 29: select coalesce(sum(amount), 0.00) into v_total_revenue ... where status = 'paid' (NO DATE FILTER!!!!).
    // So it is LIFETIME revenue.
    const { data: revenueRows } = await supabase.from('subscription_history').select('amount').eq('status', 'paid');
    const totalRevenue = revenueRows.reduce((a, b) => a + (Number(b.amount) || 0), 0);

    // D. System Health
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const { count: errorCount24h } = await supabase.from('error_logs')
        .select('*', { count: 'exact', head: true })
        .eq('severity', 'critical')
        .gt('created_at', twentyFourHoursAgo);

    const status = (errorCount24h > 10) ? 'CRITICAL' : (errorCount24h > 0) ? 'DEGRADED' : 'HEALTHY';

    const snapshot = {
        totalUsers: totalUsers || 0,
        activeUsers: activeUsers || 0,
        revenue30dPaid: totalRevenue, // Mimicking RPC behavior found in code
        systemHealth: {
            status: status,
            errorCount24h: errorCount24h || 0
        },
        snapshotTimestamp: Date.now()
    };


    // --- 2. SIMULATE get_admin_revenue_ledger (30D) ---
    // Start date 30 days ago
    const startDate = thirtyDaysAgo.toISOString();

    // Get transactions
    const { data: txs, error: txError } = await supabase.from('subscription_history')
        .select('*')
        .gte('created_at', startDate)
        .eq('status', 'paid')
        .order('created_at', { ascending: false })
        .limit(50);

    if (txError) console.error("Tx Error:", txError);

    // If join fails (RLS on joined tables?), we might get raw user_id. 
    // With service key, joins "should" work if relations exist. 
    // But subscription_history might not have relation defined in client types.
    // Let's do manual map if needed.

    // We already have users list from earlier (auth)
    const userMap = new Map(users.map(u => [u.id, u.email]));

    // Fetch profiles for company names
    const userIds = txs ? txs.map(t => t.user_id) : [];
    const { data: profiles } = await supabase.from('profiles').select('id, company_name').in('id', userIds);
    const companyMap = new Map(profiles ? profiles.map(p => [p.id, p.company_name]) : []);

    const transactions = (txs || []).map(t => ({
        id: t.id,
        date: t.created_at,
        amount: Number(t.amount),
        currency: t.currency,
        status: t.status,
        plan: t.plan_name,
        userId: t.user_id,
        userEmail: userMap.get(t.user_id) || 'Unknown',
        companyName: companyMap.get(t.user_id) || 'Unknown Company'
    }));

    // Total Revenue for this period (30D)
    // We need to query ALL matching rows for sum, not just limit 50
    const { data: allPeriodTxs } = await supabase.from('subscription_history')
        .select('amount')
        .gte('created_at', startDate)
        .eq('status', 'paid');

    const periodRevenue = (allPeriodTxs || []).reduce((a, b) => a + (Number(b.amount) || 0), 0);

    const ledger = {
        totalRevenue: periodRevenue,
        totalCount: allPeriodTxs ? allPeriodTxs.length : 0,
        transactions: transactions
    };

    const output = {
        snapshot,
        ledger
    };
    fs.writeFileSync(path.resolve(__dirname, 'rpc_samples.json'), JSON.stringify(output, null, 2));
    console.log("Written to rpc_samples.json");
}

run().catch(console.error);
