
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase environment variables')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkUser() {
    const email = 'austin.simonsps4@gmail.com'
    console.log(`Checking status for: ${email}`)

    const { data: { users }, error } = await supabase.auth.admin.listUsers()

    if (error) {
        console.error('Error fetching users:', error)
        return
    }

    const user = users.find(u => u.email === email)

    if (!user) {
        console.log('User NOT FOUND in Auth table.')
    } else {
        console.log('User FOUND:')
        console.log(`- ID: ${user.id}`)
        console.log(`- Email: ${user.email}`)
        console.log(`- Confirmed At: ${user.email_confirmed_at}`)
        console.log(`- Last Sign In: ${user.last_sign_in_at}`)
        console.log(`- Banned: ${user.banned_until || 'No'}`)

        // Check identities to see provider
        if (user.identities) {
            console.log('- Identities:', user.identities.map(i => i.provider).join(', '))
        }
    }
}

checkUser()
