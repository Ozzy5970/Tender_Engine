
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function debug() {
    console.log('--- DETAILED RPC DEBUG ---')
    // We try to call it. Since we use service_role, we might bypass auth.uid() if not careful, 
    // but the RPC has a check: if not exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.is_admin = true)
    // auth.uid() is null in this script context.

    // Let's check the function definition directly via SQL
    const { data, error } = await supabase.rpc('get_admin_users')

    if (error) {
        console.log('Error Message:', error.message)
        console.log('Error Code:', error.code)
        console.log('Error Details:', error.details)
        console.log('Hint:', error.hint)
    } else {
        console.log('Success! Columns returned:', Object.keys(data[0] || {}))
    }
}

debug()
