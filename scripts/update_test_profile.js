
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

// Load env vars
dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase environment variables')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function updateProfile() {
    const email = 'austin.simonsps4@gmail.com'
    console.log(`Looking for user: ${email}`)

    // 1. Get User ID - Using Admin API to find the user by email
    const { data: { users }, error: userError } = await supabase.auth.admin.listUsers()

    if (userError) {
        console.error('Error listing users:', userError)
        return
    }

    const user = users.find(u => u.email === email)

    if (!user) {
        console.error(`User ${email} not found! Please sign up first.`)
        return
    }

    console.log(`Found user ID: ${user.id}`)

    // 2. Update Profile with comprehensive test data
    const updates = {
        full_name: 'Austin Simons',
        company_name: 'Simons Civil Projects (Pty) Ltd',
        registration_number: '2023/159753/07',
        tax_reference_number: '9234567890',
        phone: '+27 82 555 0144',
        address: 'Suite 204, The Rubik, 19 Loop Street, Cape Town, 8001',
        location: 'Cape Town, Western Cape',
        updated_at: new Date().toISOString()
    }

    const { error: updateError } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id)

    if (updateError) {
        console.error('Error updating profile:', updateError)
    } else {
        console.log('✅ Successfully updated profile data.')
        console.log('----------------------------------------')
        console.log('Company:      Simons Civil Projects (Pty) Ltd')
        console.log('Reg Number:   2023/159753/07')
        console.log('Tax Ref:      9234567890')
        console.log('Location:     Cape Town, Western Cape')
        console.log('----------------------------------------')
    }
}

updateProfile()
