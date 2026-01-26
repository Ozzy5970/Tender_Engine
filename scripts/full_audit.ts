
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

// Load Env
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
    console.error("❌ Missing credentials (SUPABASE_URL or SERVICE_KEY)")
    process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey)

async function checkTable(tableName: string, requiredColumns: string[]) {
    console.log(`\n🔍 Checking Table: '${tableName}'...`)

    // 1. Check existence by selecting 1 row
    const { data, error } = await supabase.from(tableName).select('id').limit(1)

    if (error) {
        if (error.code === '42P01') {
            console.error(`   ❌ FAIL: Table '${tableName}' DOES NOT EXIST.`)
            return false
        } else {
            console.error(`   ⚠️ WARN: Could not access '${tableName}'. Error: ${error.message}`)
            return false
        }
    } else {
        console.log(`   ✅ Table exists.`)
    }

    // 2. Check individual columns
    // We can't request schema info easily via JS client, so we try to SELECT the columns.
    // If a column is missing, it will throw an error.
    const colString = requiredColumns.join(',')
    const { error: colError } = await supabase.from(tableName).select(colString).limit(1)

    if (colError) {
        console.error(`   ❌ FAIL: Some columns are MISSING. Error: ${colError.message}`)
        // Try to identify which one by checking one by one
        for (const col of requiredColumns) {
            const { error: singleColError } = await supabase.from(tableName).select(col).limit(1)
            if (singleColError) {
                console.error(`      ❌ Column '${col}' is MISSING.`)
            } else {
                console.log(`      ✅ Column '${col}' exists.`)
            }
        }
    } else {
        console.log(`   ✅ All required columns exist: [${requiredColumns.join(', ')}]`)
    }
}

async function run() {
    console.log("🏥 STARTING SYSTEM HEALTH CHECK 🏥")

    // 1. Check Profiles (Crucial for Auth & Tiers)
    await checkTable('profiles', [
        'full_name',
        'company_name',
        'tier',
        'phone',
        'address',
        'location',
        'notify_email_tier_support',
        'notify_whatsapp_tier_reminders',
        'notify_email_critical_errors'
    ])

    // 2. Check Tenders (Crucial for Core Business)
    await checkTable('tenders', [
        'title',
        'description',
        'sector',
        'has_rated' // Added in feedback migration
    ])

    // 3. Check Feedback (New Feature)
    await checkTable('user_feedback', [
        'user_id',
        'rating',
        'message',
        'tender_id'
    ])

    // 4. Check Error Logs (New Feature)
    await checkTable('error_logs', [
        'page',
        'description',
        'severity',
        'stack_trace'
    ])

    // 5. Check Subscription History 
    await checkTable('subscription_history', [
        'plan_name',
        'amount',
        'status'
    ])

    console.log("\n🏁 HEALTH CHECK COMPLETE")
}

run()
