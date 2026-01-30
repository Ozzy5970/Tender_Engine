
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function investigate() {
    const { data: history } = await supabase.from('subscription_history').select('user_id, amount')
    const { data: profiles } = await supabase.from('profiles').select('id, email')

    const emailMap = new Map()
    profiles?.forEach(p => emailMap.set(p.id, p.email))

    console.log('--- REVENUE BY USER ---')
    history?.forEach(h => {
        console.log(`${emailMap.get(h.user_id) || h.user_id}: R${h.amount}`)
    })
    console.log('-----------------------')
}

investigate()
