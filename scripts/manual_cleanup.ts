
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import * as fs from 'fs'

dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
    fs.writeFileSync('manual_deletion_log.txt', 'Missing Supabase environment variables')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function manualCleanup() {
    const emailToDelete = 'itskylanie@gmail.com'
    let log = `Manual cleanup for: ${emailToDelete}\n`

    try {
        const { data: { users }, error: listError } = await supabase.auth.admin.listUsers()
        if (listError) throw listError
        const user = users.find(u => u.email === emailToDelete)
        if (!user) {
            log += "User not found.\n"
            fs.writeFileSync('manual_deletion_log.txt', log)
            return
        }
        const userId = user.id
        log += `User ID: ${userId}\n`

        const tables = [
            { name: 'audit_logs', col: 'actor_id' },
            { name: 'subscription_history', col: 'user_id' },
            { name: 'subscriptions', col: 'user_id' },
            { name: 'compliance_documents', col: 'user_id' },
            { name: 'user_feedback', col: 'user_id' },
            { name: 'error_logs', col: 'user_id' },
            { name: 'alerts', col: 'user_id' },
            { name: 'profiles', col: 'id' }
        ]

        for (const table of tables) {
            log += `Clearing ${table.name}... `
            const { error } = await supabase.from(table.name).delete().eq(table.col, userId)
            if (error) {
                log += `FAILED: ${error.message} (${error.code})\n`
            } else {
                log += `OK\n`
            }
        }

        log += `Finally, deleting from auth.users... `
        const { error: authError } = await supabase.auth.admin.deleteUser(userId)
        if (authError) {
            log += `FAILED: ${authError.message}\n`
        } else {
            log += `OK\n`
        }

    } catch (err: any) {
        log += `Unexpected script error: ${err.message}\n`
    }

    fs.writeFileSync('manual_deletion_log.txt', log)
    console.log(log)
}

manualCleanup()
