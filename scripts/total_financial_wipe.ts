
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function totalWipe() {
    console.log('--- TOTAL FINANCIAL WIPE ---')

    // Decisive: Delete all records from these tables
    const { error: hErr } = await supabase.from('subscription_history').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    console.log(`Wiped history: ${hErr ? hErr.message : 'OK'}`)

    const { error: sErr } = await supabase.from('subscriptions').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    console.log(`Wiped subscriptions: ${sErr ? sErr.message : 'OK'}`)

    const { data: history } = await supabase.from('subscription_history').select('id')
    console.log(`History count: ${history?.length || 0}`)
}

totalWipe()
