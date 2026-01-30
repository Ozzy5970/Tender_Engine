
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function simulate() {
    console.log('--- REALISTIC SIMULATION START ---')

    // 1. Target Users
    const users = [
        {
            email: 'reubenjacobs123@gmail.com',
            journey: 'Pro', // Tier 3
            profile: {
                full_name: 'Reuben Jacobs',
                company_name: 'Reuben Jacobs Construction (Pty) Ltd',
                registration_number: '2023/123456/07',
                tax_reference_number: '9123456789',
                tier: 'Pro'
            },
            amount: 1999.00
        },
        {
            email: 'itskylanie@gmail.com',
            journey: 'Free',
            profile: {
                full_name: 'Klanie M',
                company_name: 'Klanie Construction & Supplies',
                tier: 'Free'
            }
        },
        {
            email: 'austin.simonsps4@gmail.com',
            journey: 'Free',
            profile: {
                company_name: 'New Company', // Incomplete
                tier: 'Free'
            }
        }
    ]

    for (const u of users) {
        console.log(`Processing ${u.email}...`)

        // Find existing profile
        const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .eq('email', u.email)
            .maybeSingle()

        if (!profile) {
            console.warn(`User ${u.email} not found. Skipping.`)
            continue
        }

        // Update Profile
        console.log(`  - Updating profile for ${u.email}`)
        await supabase
            .from('profiles')
            .update(u.profile)
            .eq('id', profile.id)

        if (u.journey === 'Pro') {
            // Simulate Payment
            console.log(`  - Simulating Tier 3 Payment (R${u.amount})`)

            // Insert current active sub
            await supabase.from('subscriptions').upsert({
                user_id: profile.id,
                plan_name: 'Pro',
                amount: u.amount,
                status: 'active',
                updated_at: new Date().toISOString()
            })

            // Insert single transaction history (Mirrors real world purchase)
            await supabase.from('subscription_history').insert({
                user_id: profile.id,
                plan_name: 'Pro',
                amount: u.amount,
                status: 'paid',
                period_start: new Date().toISOString()
            })

            // Simulate a document upload
            console.log(`  - Simulating CIDB Cert upload`)
            await supabase.from('company_documents').insert({
                profile_id: profile.id,
                doc_type: 'CIDB Certificate',
                file_url: 'simulated/cidb.pdf',
                status: 'verified',
                expiry_date: '2027-12-31'
            })
        }
    }

    console.log('--- SIMULATION COMPLETE ---')
}

simulate().catch(console.error)
