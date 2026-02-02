
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl!, supabaseKey!)

async function count() {
    const { count, error } = await supabase
        .from('admins')
        .select('*', { count: 'exact', head: true })

    if (error) console.error('Error:', error)
    else console.log('Admins count:', count)
}

count()
