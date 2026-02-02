
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

// Load env from frontend directory
dotenv.config({ path: path.resolve(__dirname, '../frontend/.env') })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("❌ Missing Supabase URL or Key. Check .env")
    process.exit(1)
}

const isAnon = !process.env.SUPABASE_SERVICE_ROLE_KEY
if (isAnon) console.warn("⚠️ Using ANON KEY. RLS checks will be limited.")

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function runHealthCheck() {
    console.log("🏥 STARTING SYSTEM HEALTH CHECK...")
    console.log(`Target: ${supabaseUrl}`)

    try {
        // 1. Check Admins Table Existence
        console.log("\n1. Checking 'admins' table...")
        const { data: admins, error: adminError } = await supabase.from('admins').select('*')

        if (adminError) {
            console.error("❌ 'admins' table check FAILED:", adminError.message)
            console.error("   (Did you run the emergency_rls_reset.sql?)")
        } else {
            console.log(`✅ 'admins' table is accessible. Count: ${admins.length}`)
            // console.log("   IDs:", admins.map(a => a.id)) // Don't leak IDs in logs if sharing
        }

        // 2. Check Profiles Sync (Skipped on Anon)
        if (isAnon) {
            console.log("\n2. Checking 'profiles' admin sync... (SKIPPED: Requires Service Key)")
        } else {
            const { data: profiles, error: profileError } = await supabase.from('profiles').select('id, email, is_admin').eq('is_admin', true)

            if (profileError) {
                console.error("❌ 'profiles' fetch FAILED:", profileError.message)
            } else {
                console.log(`✅ Found ${profiles.length} admins in 'profiles' table.`)

                // Cross Reference
                const adminIds = admins?.map(a => a.id) || []
                const missing = profiles.filter(p => !adminIds.includes(p.id))

                if (missing.length > 0) {
                    console.error("❌ SYNC ERROR: These users are marked 'is_admin' in profiles but MISSING from 'admins' table:")
                    console.table(missing)
                    console.log("   -> Run 'sync_admin.ts' to fix this.")
                } else {
                    console.log("✅ Sync is PERFECT. All profile admins are in the admins table.")
                }
            }
        }


        // 3. Check RPC Function
        console.log("\n3. Checking 'get_admin_users' RPC...")
        // We can't easily check if it exists without calling it, but calling it as service role might mask RLS issues.
        // We will just try to call it.
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_admin_users')
        if (rpcError) {
            console.warn("⚠️ 'get_admin_users' RPC check failed:", rpcError.message)
            console.log("   (This might be expected if the service role call signature differs, but usually implies function is missing or broken)")
        } else {
            console.log("✅ 'get_admin_users' RPC executed successfully.")
        }

        console.log("\n🏁 HEALTH CHECK COMPLETE.")

    } catch (err) {
        console.error("❌ UNEXPECTED ERROR:", err)
    }
}

runHealthCheck()
