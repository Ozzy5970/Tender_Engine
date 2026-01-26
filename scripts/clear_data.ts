import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

// Manually parse .env from root
const envPath = path.resolve(__dirname, '../.env')
if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf-8')
    envConfig.split('\n').forEach(line => {
        const [key, value] = line.split('=')
        if (key && value) {
            process.env[key.trim()] = value.trim()
        }
    })
}

const supabaseUrl = process.env.VITE_SUPABASE_URL
// MUST use Service Role Key to manage Auth Users
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceKey) {
    console.error("Missing Supabase URL or SERVICE ROLE Key (Required for deleting users)")
    process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
})

async function clearData() {
    console.log("Starting Deep Clean...")

    // 1. List all users
    const { data: { users }, error } = await supabase.auth.admin.listUsers()

    if (error) {
        console.error("Error listing users:", error)
        return
    }

    console.log(`Found ${users.length} users. Analyzing for deletion...`)

    let deletedCount = 0
    let keptCount = 0

    for (const user of users) {
        // CHECK: Is this user an Admin?
        // We look at user_metadata OR if they are specifically named in the code (if needed)
        const isAdmin = user.user_metadata?.role === 'admin'

        if (isAdmin) {
            console.log(`[KEEP] Admin User: ${user.email} (${user.id})`)
            keptCount++
            continue
        }

        // DELETE: Normal User
        console.log(`[DELETE] User: ${user.email} (${user.id})`)
        const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id)

        if (deleteError) {
            console.error(`  Failed to delete ${user.email}:`, deleteError.message)
        } else {
            deletedCount++
        }
    }

    console.log("--------------------------------------------------")
    console.log(`Cleanup Complete.`)
    console.log(`Deleted: ${deletedCount} users (and their data via cascade)`)
    console.log(`Kept:    ${keptCount} admins`)
    console.log("--------------------------------------------------")

    // Double check orphaned data (just in case cascade didn't work, though it should)
    console.log("Cleaning up any orphaned Tenders/Docs...")
    await supabase.from('tenders').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('compliance_documents').delete().neq('id', '00000000-0000-0000-0000-000000000000')

    // Clear history too if requested, but maybe keep for admin testing? User asked to "wipe all".
    await supabase.from('subscription_history').delete().neq('id', '00000000-0000-0000-0000-000000000000')

    console.log("Deep Clean Finished.")
}

clearData()
