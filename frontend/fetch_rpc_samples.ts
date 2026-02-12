
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'

// Load env from root
const envPath = path.resolve(__dirname, '../../.env')
dotenv.config({ path: envPath })

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
    // 1. Snapshot
    const { data: snapshot, error: snapError } = await supabase.rpc('get_admin_dashboard_snapshot')
    if (snapError) console.error("Snapshot Error:", snapError)

    // 2. Ledger (30D)
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(endDate.getDate() - 30)

    const { data: ledger, error: ledgerError } = await supabase.rpc('get_admin_revenue_ledger', {
        p_period_start: startDate.toISOString(),
        p_period_end: endDate.toISOString(),
        p_limit: 50,
        p_offset: 0
    })
    if (ledgerError) console.error("Ledger Error:", ledgerError)

    console.log(JSON.stringify({
        snapshot: snapshot,
        ledger: ledger
    }, null, 2))
}

run().catch(console.error)
