
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function verify() {
    console.log('--- VERIFYING ADMINS TABLE ---')

    // 1. Check if we can select from admins table (checking existence)
    const { data: admins, error: adminsError } = await supabase
        .from('admins')
        .select('*')
        .limit(5)

    if (adminsError) {
        console.error('Error accessing admins table:', adminsError.message)
        if (adminsError.code === '42P01') {
            console.error('--> TABLE public.admins DOES NOT EXIST. Migration failed or was not run.')
        }
    } else {
        console.log('Admins table exists. Row count sample:', admins.length)
        if (admins.length > 0) {
            console.log('Sample admin:', admins[0])
        } else {
            console.warn('--> Admins table is EMPTY! Sync/Seed failed.')
        }
    }

    // 2. Check Profiles Policy via Explain (Simulated) or just checking one profile
    console.log('\n--- VERIFYING PROFILES ACCESS ---')
    // We can't easily check policies from client without being that user.
    // But we can check if we can see profiles as Service Role (should always work)
    const { count, error: countError } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })

    if (countError) {
        console.error('Error reading profiles:', countError.message)
    } else {
        console.log('Total profiles (Service Role):', count)
    }

}

verify()
