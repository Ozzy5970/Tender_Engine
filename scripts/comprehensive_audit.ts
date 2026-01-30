
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function audit() {
    console.log('--- AUDIT START ---')

    // 1. Current Active Subscriptions
    const { data: subs, error: subsError } = await supabase
        .from('subscriptions')
        .select('*')

    if (subsError) console.error('Subs Error:', subsError)
    else {
        console.log('\n[ACTIVE SUBSCRIPTIONS]')
        console.log(JSON.stringify(subs, null, 2))
    }

    // 2. Transaction History
    const { data: history, error: historyError } = await supabase
        .from('subscription_history')
        .select('*')

    if (historyError) console.error('History Error:', historyError)
    else {
        console.log('\n[SUBSCRIPTION HISTORY / TRANSACTIONS]')
        console.log(JSON.stringify(history, null, 2))
    }

    // 3. Profiles Check
    const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('*')

    if (profileError) console.error('Profile Error:', profileError)
    else {
        console.log('\n[ALL PROFILES]')
        console.log(JSON.stringify(profiles.map(p => ({
            id: p.id,
            email: p.email,
            company: p.company_name,
            tier: p.tier,
            is_admin: p.is_admin
        })), null, 2))
    }

    console.log('\n--- AUDIT END ---')
}

audit()
