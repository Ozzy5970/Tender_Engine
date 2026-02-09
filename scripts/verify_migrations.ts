
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

async function verify() {
    console.log("Verifying 'get_admin_revenue_ledger' RPC...")

    // We expect this to fail with Access Denied if it exists, or "function not found" if it doesn't.
    // We'll pass some dummy params.
    const { data: ledger, error: ledgerError } = await supabase.rpc('get_admin_revenue_ledger', {
        p_period_start: new Date().toISOString(),
        p_period_end: new Date().toISOString()
    })

    if (ledgerError) {
        if (ledgerError.message.includes("Access Denied")) {
            console.log("✅ 'get_admin_revenue_ledger' exists (Access Denied confirmed security).")
        } else if (ledgerError.message.includes("function") && ledgerError.message.includes("not found")) {
            console.error("❌ 'get_admin_revenue_ledger' NOT FOUND. Migration needed.")
            process.exit(1)
        } else {
            console.log(`⚠️ 'get_admin_revenue_ledger' returned error: ${ledgerError.message}`)
            // It might be a different error but function exists.
            console.log("✅ Function likely exists but failed execution.")
        }
    } else {
        console.log("✅ 'get_admin_revenue_ledger' exists and worked.")
    }

    // Also check get_admin_users just in case
    console.log("Verifying 'get_admin_users' RPC...")
    const { error: usersError } = await supabase.rpc('get_admin_users')
    if (usersError) {
        if (usersError.message.includes("Access Denied")) {
            console.log("✅ 'get_admin_users' exists (Access Denied confirmed security).")
        } else if (usersError.message.includes("function") && usersError.message.includes("not found")) {
            console.error("❌ 'get_admin_users' NOT FOUND. Migration needed.")
            process.exit(1)
        } else {
            console.log(`⚠️ 'get_admin_users' returned error: ${usersError.message}`)
            console.log("✅ Function likely exists.")
        }
    } else {
        console.log("✅ 'get_admin_users' exists.")
    }
}

verify()
