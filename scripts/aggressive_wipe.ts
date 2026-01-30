
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function aggressiveWipe() {
    console.log('--- AGGRESSIVE WIPE START ---')

    // 1. Get ALL Test Profiles
    const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email')
        .in('email', [
            'reubenjacobs123@gmail.com',
            'itskylanie@gmail.com',
            'austin.simonsps4@gmail.com'
        ])

    console.log(`Found profiles: ${JSON.stringify(profiles)}`)
    const ids = profiles?.map(p => p.id) || []

    if (ids.length > 0) {
        console.log(`Wiping data for IDs: ${ids.join(', ')}`)

        // Delete History
        const { error: hErr } = await supabase.from('subscription_history').delete().in('user_id', ids)
        console.log(`Deleted history: ${hErr ? hErr.message : 'OK'}`)

        // Delete Subscriptions
        const { error: sErr } = await supabase.from('subscriptions').delete().in('user_id', ids)
        console.log(`Deleted subscriptions: ${sErr ? sErr.message : 'OK'}`)

        // Delete Docs
        const { error: dErr } = await supabase.from('company_documents').delete().in('profile_id', ids)
        console.log(`Deleted documents: ${dErr ? dErr.message : 'OK'}`)

        // Reset Profiles
        const { error: pErr } = await supabase.from('profiles').update({
            tier: 'Tier 1',
            company_name: 'New Company',
            registration_number: null,
            tax_reference_number: null,
            full_name: null,
            bbbee_level: null,
            cidb_grade_grading: null,
            cidb_grade_class: null
        }).in('id', ids)
        console.log(`Reset profiles: ${pErr ? pErr.message : 'OK'}`)
    } else {
        console.log('No profiles found to wipe.')
    }

    // 2. Double Check: Is there ANY other revenue data?
    const { data: allHistory } = await supabase.from('subscription_history').select('id, amount, user_id')
    console.log(`History count remaining: ${allHistory?.length || 0}`)
    if (allHistory && allHistory.length > 0) {
        console.log('CRITICAL: Residual history found!', allHistory)
    }

    console.log('--- AGGRESSIVE WIPE COMPLETE ---')
}

aggressiveWipe()
