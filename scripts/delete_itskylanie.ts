
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import * as fs from 'fs'

dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
    fs.writeFileSync('deletion_log.txt', 'Missing Supabase environment variables')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function deleteUser() {
    const emailToDelete = 'itskylanie@gmail.com'
    let log = `Starting deletion process for: ${emailToDelete}\n`

    try {
        const { data: { users }, error: listError } = await supabase.auth.admin.listUsers()

        if (listError) {
            log += `Error listing users: ${JSON.stringify(listError)}\n`
            fs.writeFileSync('deletion_log.txt', log)
            return
        }

        const user = users.find(u => u.email === emailToDelete)

        if (!user) {
            log += `User ${emailToDelete} not found. No action taken.\n`
            fs.writeFileSync('deletion_log.txt', log)
            return
        }

        log += `Found user ID: ${user.id}. Proceeding with deletion...\n`

        const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id)

        if (deleteError) {
            log += `Error during deletion: ${JSON.stringify(deleteError)}\n`
        } else {
            log += `✅ Successfully deleted user: ${emailToDelete} (ID: ${user.id})\n`
            log += `Note: Data should cascade to linked tables (profiles, etc.) if DB constraints are set up.\n`
        }
    } catch (err: any) {
        log += `Unexpected script error: ${err.message}\n`
    }

    fs.writeFileSync('deletion_log.txt', log)
    console.log(log)
}

deleteUser()
