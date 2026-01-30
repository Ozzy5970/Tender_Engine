
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

async function addTestTender() {
    const email = 'austin.simonsps4@gmail.com'
    console.log(`Looking for user: ${email}`)

    // 1. Get User ID
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

    // 2. Insert Test Tender
    const tender = {
        user_id: user.id,
        title: 'TEST TENDER: Road Upgrade Project',
        client_name: 'City of Cape Town',
        reference_number: 'CCT/2026/001',
        closing_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
        status: 'DRAFT',
        readiness: 'RED',
        compliance_score: 10
    }

    const { data, error } = await supabase
        .from('tenders')
        .insert(tender)
        .select()
        .single()

    if (error) {
        console.error('Error creating tender:', error)
    } else {
        console.log('✅ Successfully created 1 test tender.')
        console.log('----------------------------------------')
        console.log(`Title:  ${data.title}`)
        console.log(`Ref:    ${data.reference_number}`)
        console.log(`ID:     ${data.id}`)
        console.log('----------------------------------------')
    }
}

addTestTender()
