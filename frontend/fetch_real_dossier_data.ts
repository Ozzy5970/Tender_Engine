
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'


// Manually load env from root
// Assumes running from project root
const envPath = path.resolve(process.cwd(), '.env')
if (fs.existsSync(envPath)) {
    const envConfig = dotenv.parse(fs.readFileSync(envPath))
    for (const k in envConfig) {
        process.env[k] = envConfig[k]
    }
}


const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
})

async function run() {
    console.log("--- FETCHING DATA ---")

    // 1. Snapshot Components
    // Total Users
    // auth.admin.listUsers() is paginated, but we can get a rough count or just page a bit.
    // Actually, listUsers({ page: 1, perPage: 1 }) returns total? No, it returns `data` and `error` and `pageInfo`.
    // Wait, supabase-js v2 `listUsers` doesn't return total count easily without iterating.
    // I'll just use a direct query if possible, or just accept I might need to approximate or just list a bunch.
    // Actually, I can use `supabase.from('profiles').select('*', { count: 'exact', head: true })` since profiles ~ users.
    const { count: totalUsers } = await supabase.from('profiles').select('*', { count: 'exact', head: true })

    // Active Users (30d) - approximate using profiles updated_at or similar? 
    // Real RPC uses auth.users last_sign_in_at. I can't query that easily with `from`.
    // I will use `auth.admin.listUsers()` and filter in memory (might be slow if many users, but safe for sample).
    const { data: users } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const activeUsers = users?.users.filter(u =>
        (u.last_sign_in_at && new Date(u.last_sign_in_at) > thirtyDaysAgo) ||
        (u.created_at && new Date(u.created_at) > thirtyDaysAgo)
    ).length || 0

    // Revenue 30d
    const thirtyDaysAgoIso = thirtyDaysAgo.toISOString()
    const { data: revData } = await supabase
        .from('subscription_history')
        .select('amount')
        .eq('status', 'paid')
        .gte('created_at', thirtyDaysAgoIso)

    const revenue30dPaid = revData?.reduce((sum, row) => sum + (Number(row.amount) || 0), 0) || 0

    // System Health (Error Logs)
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
    const { count: errorCount24h } = await supabase
        .from('error_logs')
        .select('*', { count: 'exact', head: true })
        .eq('severity', 'critical')
        .gt('created_at', twentyFourHoursAgo)

    const status = (errorCount24h || 0) > 10 ? 'CRITICAL' : (errorCount24h || 0) > 0 ? 'DEGRADED' : 'HEALTHY'

    const snapshotResponse = {
        totalUsers: totalUsers || 0,
        activeUsers: activeUsers,
        revenueLast30Days: revenue30dPaid,
        systemHealth: {
            status,
            errorCount24h: errorCount24h || 0
        },
        snapshotTimestamp: Date.now()
    }


    // 2. Revenue Ledger Components
    // Period: 30D
    const { data: transactions } = await supabase
        .from('subscription_history')
        .select('id, username:user_id, amount, currency, status, plan_name, created_at, user_id')
        .gte('created_at', thirtyDaysAgoIso)
        .eq('status', 'paid')
        .order('created_at', { ascending: false })
        .limit(50)

    const userIds = transactions?.map(t => t.user_id) || []
    const { data: profiles } = await supabase.from('profiles').select('id, company_name').in('id', userIds)
    const profileMap = new Map(profiles?.map(p => [p.id, p]))

    // reused users from above
    const userMap = new Map(users?.users.map(u => [u.id, u]))

    const ledgerTransactions = transactions?.map(t => ({
        id: t.id,
        date: t.created_at,
        amount: Number(t.amount),
        currency: t.currency,
        status: t.status,
        plan: t.plan_name,
        userId: t.user_id,
        userEmail: userMap.get(t.user_id)?.email || 'Unknown',
        companyName: profileMap.get(t.user_id)?.company_name || 'Unknown Company'
    })) || []

    const totalRevenue = ledgerTransactions.reduce((sum, t) => sum + t.amount, 0)

    const ledgerResponse = {
        totalRevenue,
        totalCount: ledgerTransactions.length,
        transactions: ledgerTransactions
    }

    const output = {
        snapshot: snapshotResponse,
        ledger: ledgerResponse
    }
    fs.writeFileSync(path.resolve(process.cwd(), 'dossier_data.json'), JSON.stringify(output, null, 2), 'utf-8')
    console.log("Data written to dossier_data.json")
}

run().catch(console.error)
