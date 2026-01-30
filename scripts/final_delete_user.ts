
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import * as fs from 'fs'

dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
    fs.writeFileSync('final_deletion_log.txt', 'Missing Supabase environment variables')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function finalDelete() {
    const emailToDelete = 'itskylanie@gmail.com'
    let log = `Final deletion attempt for: ${emailToDelete}\n`

    try {
        const { data: { users }, error: listError } = await supabase.auth.admin.listUsers()
        if (listError) throw listError
        const user = users.find(u => u.email === emailToDelete)

        if (!user) {
            log += "User already gone from auth.users.\n"
        } else {
            const userId = user.id
            log += `User ID found: ${userId}\n`

            // 1. Clear storage (Common blocker)
            log += "Clearing storage objects... "
            const { error: storageError } = await supabase.schema('storage').from('objects').delete().eq('owner', userId)
            log += storageError ? `Err: ${storageError.message}\n` : "OK\n"

            // 2. Clear known public tables again
            const publicTables = ['legal_consents', 'compliance_documents', 'subscription_history', 'subscriptions', 'audit_logs', 'user_feedback', 'error_logs', 'alerts', 'profiles']
            for (const table of publicTables) {
                log += `Clearing public.${table}... `
                const col = table === 'profiles' ? 'id' : (table === 'audit_logs' ? 'actor_id' : 'user_id')
                const { error } = await supabase.from(table).delete().eq(col, userId)
                log += error ? `Err: ${error.message}\n` : "OK\n"
            }

            // 3. Final Auth Delete
            log += "Deleting from auth.users... "
            const { error: authError } = await supabase.auth.admin.deleteUser(userId)
            if (authError) {
                log += `FAILED: ${JSON.stringify(authError)}\n`
            } else {
                log += "✅ SUCCESS\n"
            }
        }
    } catch (err: any) {
        log += `Unexpected error: ${err.message}\n`
    }

    fs.writeFileSync('final_deletion_log.txt', log)
    console.log(log)
}

finalDelete()
