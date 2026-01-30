
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function fixData() {
    const users = [
        {
            email: 'reubenjacobs123@gmail.com',
            id: '0044fd5d-de94-44be-bcf5-a6be165ed674',
            plan: 'Pro',
            amount: 1999.00,
            company: 'Reuben Jacobs Construction'
        },
        {
            email: 'itskylanie@gmail.com',
            id: '564b18cc-9061-46ef-b02d-6aa7b26b5b42',
            plan: 'Standard',
            amount: 499.00,
            company: 'Klanie Construction & Supplies'
        }
    ]

    for (const user of users) {
        console.log(`Processing ${user.email}...`)

        // 1. Update Profile Tier
        await supabase
            .from('profiles')
            .update({ tier: user.plan })
            .eq('id', user.id)

        // 2. Update/Insert Current Subscription
        const { data: existingSub } = await supabase
            .from('subscriptions')
            .select('id')
            .eq('user_id', user.id)
            .maybeSingle()

        if (existingSub) {
            await supabase
                .from('subscriptions')
                .update({
                    plan_name: user.plan,
                    amount: user.amount,
                    status: 'active',
                    updated_at: new Date().toISOString()
                })
                .eq('id', existingSub.id)
        } else {
            await supabase
                .from('subscriptions')
                .insert({
                    user_id: user.id,
                    plan_name: user.plan,
                    amount: user.amount,
                    status: 'active'
                })
        }

        // 3. Insert History Record (Transaction)
        // We delete first to avoid duplicates if re-run, or just insert a fresh one
        await supabase
            .from('subscription_history')
            .insert({
                user_id: user.id,
                plan_name: user.plan,
                amount: user.amount,
                status: 'paid',
                period_start: new Date().toISOString()
            })

        console.log(`✅ Fixed data for ${user.email}`)
    }

    console.log('--- ALL DATA FIXED ---')
}

fixData()
