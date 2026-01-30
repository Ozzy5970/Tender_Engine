
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import * as fs from 'fs'

dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
    fs.writeFileSync('recent_users.txt', 'Missing Supabase environment variables')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function findRecentUsers() {
    const { data: { users }, error } = await supabase.auth.admin.listUsers()

    if (error) {
        fs.writeFileSync('recent_users.txt', `Error fetching users: ${JSON.stringify(error)}`)
        return
    }

    const sortedUsers = users.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    let output = 'Recent Users:\n'
    sortedUsers.slice(0, 5).forEach(user => {
        output += `Email: ${user.email} | Created: ${user.created_at} | Last Sign In: ${user.last_sign_in_at} | ID: ${user.id}\n`
    })

    fs.writeFileSync('recent_users.txt', output)
}

findRecentUsers()
