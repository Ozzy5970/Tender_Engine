
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function simulate() {
    // 1. itskylanie@gmail.com - Simulate full profile
    const klanieId = '564b18cc-9061-46ef-b02d-6aa7b26b5b42'
    console.log('Simulating data for itskylanie@gmail.com...')

    const klanieUpdates = {
        full_name: 'Klanie M',
        company_name: 'Klanie Construction & Supplies',
        registration_number: '2022/654321/07',
        tax_reference_number: '1234567890',
        phone: '+27 71 234 5678',
        address: '123 Pine Road, Sandton, Johannesburg, 2196',
        location: 'Johannesburg, Gauteng',
        updated_at: new Date().toISOString()
    }

    const { error: klanieError } = await supabase
        .from('profiles')
        .update(klanieUpdates)
        .eq('id', klanieId)

    if (klanieError) console.error('Klanie Update Error:', klanieError)
    else console.log('✅ itskylanie@gmail.com profile updated.')

    // 2. reubenjacobs123@gmail.com - Upgrade to Tier 3 (Pro)
    const reubenId = '0044fd5d-de94-44be-bcf5-a6be165ed674'
    console.log('Upgrading reubenjacobs123@gmail.com to Tier 3 (Pro)...')

    // Update profiles.tier if it exists
    const { error: reubenProfileError } = await supabase
        .from('profiles')
        .update({ tier: 'Pro' })
        .eq('id', reubenId)

    if (reubenProfileError) console.warn('Reuben Profile Tier update (optional) failed:', reubenProfileError.message)

    // Insert or Update active subscription
    const { data: existingSub } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('user_id', reubenId)
        .maybeSingle()

    if (existingSub) {
        const { error: subUpdateError } = await supabase
            .from('subscriptions')
            .update({
                plan_name: 'Pro',
                amount: 499.00,
                status: 'active',
                updated_at: new Date().toISOString()
            })
            .eq('id', existingSub.id)
        if (subUpdateError) console.error('Reuben Sub Update Error:', subUpdateError)
        else console.log('✅ reubenjacobs123@gmail.com subscription updated to Pro.')
    } else {
        const { error: subInsertError } = await supabase
            .from('subscriptions')
            .insert({
                user_id: reubenId,
                plan_name: 'Pro',
                amount: 499.00,
                status: 'active'
            })
        if (subInsertError) console.error('Reuben Sub Insert Error:', subInsertError)
        else console.log('✅ reubenjacobs123@gmail.com subscription created as Pro.')
    }
}

simulate()
