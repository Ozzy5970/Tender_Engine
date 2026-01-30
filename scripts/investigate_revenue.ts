
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function investigate() {
    console.log('--- REVENUE INVESTIGATION ---')

    // 1. All Transactions
    const { data: history } = await supabase
        .from('subscription_history')
        .select('*, profile:profiles(email, company_name)')

    console.log('HISTORY LOG:')
    console.table(history?.map(h => ({
        User: h.profile?.email || h.user_id,
        Plan: h.plan_name,
        Amount: h.amount,
        Date: h.created_at
    })))

    // 2. All Active Subs
    const { data: subs } = await supabase
        .from('subscriptions')
        .select('*, profile:profiles(email)')

    console.log('\nACTIVE SUBSCRIPTIONS:')
    console.table(subs?.map(s => ({
        User: s.profile?.email || s.user_id,
        Plan: s.plan_name,
        Amount: s.amount
    })))

    console.log('\n--- INVESTIGATION COMPLETE ---')
}

investigate()
