
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function listAuthUsers() {
    const { data, error } = await supabase.auth.admin.listUsers()
    if (error) {
        console.error('Error:', error)
        return
    }
    const filtered = data.users.filter(u => [
        'reubenjacobs123@gmail.com',
        'itskylanie@gmail.com',
        'austin.simonsps4@gmail.com'
    ].includes(u.email || ''))

    console.log(JSON.stringify(filtered.map(u => ({ id: u.id, email: u.email })), null, 2))
}

listAuthUsers()
