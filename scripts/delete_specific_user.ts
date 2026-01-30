
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

async function deleteUser() {
    const email = 'itskylanie@gmail.com'
    console.log(`Searching for user: ${email}`)

    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers()

    if (listError) {
        console.error('Error listing users:', listError)
        return
    }

    const user = users.find(u => u.email === email)

    if (!user) {
        console.log('User not found. Nothing to delete.')
        return
    }

    console.log(`Found user ID: ${user.id}`)
    console.log('Deleting user and cascading data...')

    const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id)

    if (deleteError) {
        console.error('Error deleting user:', deleteError)
    } else {
        console.log('✅ User deleted successfully.')
        console.log('This should have cascaded to profiles, tenders, and companies if foreign keys are correct.')
    }
}

deleteUser()
