
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function list() {
    const { data: profiles } = await supabase.from('profiles').select('id, email, company_name')
    console.log(JSON.stringify(profiles, null, 2))
}

list()
