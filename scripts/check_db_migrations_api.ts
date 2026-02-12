
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

// Load env from frontend directory
dotenv.config({ path: path.resolve(__dirname, '../frontend/.env') })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("❌ Missing Supabase URL or Key. Check .env")
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkMigrations() {
    console.log("Checking migrations via RPC...")

    // Try to list migrations via system view if possible, or just check 'schema_migrations' table directly
    const { data: migrations, error } = await supabase
        .from('schema_migrations')
        .select('*')
        .order('version', { ascending: false })
        .limit(5)

    if (error) {
        console.error("❌ Cannot access schema_migrations via API:", error.message)
    } else {
        console.log("✅ Last 5 applied migrations:")
        console.table(migrations)
    }
}

checkMigrations()
