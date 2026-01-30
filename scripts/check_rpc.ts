
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkRPC() {
    console.log('--- RPC CHECK ---')
    const { data, error } = await supabase.rpc('get_admin_users')
    if (error) {
        console.error('RPC Error:', error.message, error.code)
    } else if (data && data.length > 0) {
        console.log('RPC Columns found:', Object.keys(data[0]).join(', '))
        const hasNeeded = ['full_name', 'profile_complete', 'sub_plan'].every(c => Object.keys(data[0]).includes(c))
        console.log('Has all required columns for UI:', hasNeeded ? 'YES' : 'NO')
    } else {
        console.log('RPC returned no data, but no error.')
    }
}

checkRPC()
