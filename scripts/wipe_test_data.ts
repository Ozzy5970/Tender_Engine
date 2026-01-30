
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

const TEST_EMAILS = [
    'reubenjacobs123@gmail.com',
    'itskylanie@gmail.com',
    'austin.simonsps4@gmail.com'
]

async function wipe() {
    console.log('--- WIPE START ---')

    // 1. Fetch User IDs
    const { data: profiles, error: pError } = await supabase
        .from('profiles')
        .select('id, email')
        .in('email', TEST_EMAILS)

    if (pError) throw pError
    const userIds = profiles.map(p => p.id)
    console.log(`Targeting ${userIds.length} users: ${profiles.map(p => p.email).join(', ')}`)

    if (userIds.length === 0) {
        console.log('No test users found to wipe.')
        return
    }

    // 2. Wipe Documents
    console.log('Wiping company_documents...')
    await supabase.from('company_documents').delete().in('profile_id', userIds)

    // 3. Wipe Subscription History
    console.log('Wiping subscription_history...')
    await supabase.from('subscription_history').delete().in('user_id', userIds)

    // 4. Wipe Subscriptions
    console.log('Wiping subscriptions...')
    await supabase.from('subscriptions').delete().in('user_id', userIds)

    // 5. Reset Profiles
    console.log('Resetting profiles to default/Free...')
    await supabase.from('profiles').update({
        tier: 'Tier 1',
        company_name: 'New Company',
        registration_number: null,
        tax_reference_number: null,
        full_name: null,
        bbbee_level: null,
        cidb_grade_grading: null,
        cidb_grade_class: null
    }).in('id', userIds)

    console.log('--- WIPE COMPLETE ---')
}

wipe().catch(console.error)
