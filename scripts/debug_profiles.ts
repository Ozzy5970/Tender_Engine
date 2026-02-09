
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function debug() {
    const { data: profiles, error } = await supabase.from('profiles').select('id, company_name')
    if (error) {
        console.error('Error fetching profiles:', error)
    } else {
        console.log(`Total Profiles: ${profiles?.length || 0}`)
        console.log('Sample Profiles:', JSON.stringify(profiles?.slice(0, 5), null, 2))
    }
}

debug()
