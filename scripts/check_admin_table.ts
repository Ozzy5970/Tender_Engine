
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function check() {
    console.log("Checking 'admins' table content...")
    const { data: admins, error } = await supabase.from('admins').select('id')

    if (error) {
        console.error("Error checking table:", error.message)
    } else {
        console.log(`Table 'admins' has ${admins?.length} rows.`)
        // List IDs to match against known emails
        const { data: users } = await supabase.auth.admin.listUsers()

        admins?.forEach(a => {
            const user = users.users.find(u => u.id === a.id)
            console.log(`- Admin: ${user?.email || 'Unknown Email'} (${a.id})`)
        })
    }
}

check()
