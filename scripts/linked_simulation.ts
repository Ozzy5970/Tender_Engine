
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function simulate() {
    console.log('--- HARDCODED SIMULATION START ---')

    const usersToProcess = [
        {
            id: '0044fd5d-de94-44be-bcf5-a6be165ed674',
            email: 'reubenjacobs123@gmail.com',
            plan: 'Pro',
            amount: 1999.00,
            profile: {
                full_name: 'Reuben Jacobs',
                company_name: 'Reuben Jacobs Construction (Pty) Ltd',
                registration_number: '2023/123456/07',
                tax_reference_number: '9123456789',
                tier: 'Pro'
            }
        },
        {
            id: '564b18cc-9061-46ef-b02d-6aa7b26b5b42',
            email: 'itskylanie@gmail.com',
            plan: 'Free',
            profile: {
                full_name: 'Klanie M',
                company_name: 'Klanie Construction & Supplies',
                tier: 'Free',
                registration_number: null,
                tax_reference_number: null
            }
        },
        {
            id: 'faaaf0ba-77d3-4411-b3c7-21bf04b55400',
            email: 'austin.simonsps4@gmail.com',
            plan: 'Free',
            profile: {
                company_name: 'New Company',
                tier: 'Free'
            }
        }
    ]

    for (const u of usersToProcess) {
        console.log(`Processing ${u.email} (ID: ${u.id})...`)

        // A. Update Profile
        await supabase.from('profiles').update(u.profile).eq('id', u.id)

        if (u.plan === 'Pro') {
            // B. Simulate Payment
            await supabase.from('subscriptions').upsert({
                user_id: u.id,
                plan_name: 'Pro',
                amount: u.amount,
                status: 'active',
                updated_at: new Date().toISOString()
            })

            // C. Log History
            await supabase.from('subscription_history').insert({
                user_id: u.id,
                plan_name: 'Pro',
                amount: u.amount,
                status: 'paid',
                period_start: new Date().toISOString()
            })

            // D. Add Doc
            await supabase.from('company_documents').insert({
                profile_id: u.id,
                doc_type: 'CIDB Certificate',
                file_url: 'simulated/cidb.pdf',
                status: 'verified',
                expiry_date: '2027-12-31'
            })
        }
    }

    console.log('--- HARDCODED SIMULATION COMPLETE ---')
}

simulate().catch(console.error)
