
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const envPath = path.resolve(__dirname, '../.env')
if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf-8')
    envConfig.split('\n').forEach(line => {
        const [key, value] = line.split('=')
        if (key && value) process.env[key.trim()] = value.trim()
    })
}

const supabaseUrl = process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !serviceKey) {
    console.error("Missing credentials")
    process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey)

async function run() {
    // We can't run raw SQL from client usually. 
    // But we can check if the table exists by trying to select from it.
    const { error } = await supabase.from('subscription_history').select('id').limit(1)

    if (error && error.code === '42P01') { // Undefined table
        console.log("Table 'subscription_history' missing. Please run the migration: supabase/migrations/20260126170000_subscription_history.sql")
    } else {
        console.log("Table 'subscription_history' exists (or other error).")
    }
}

run()
