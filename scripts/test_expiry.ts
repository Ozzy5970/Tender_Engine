import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

// Load environment variables manually to avoid dotenv resolution issues
const envPath = path.resolve(__dirname, '../.env')
if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf-8')
    envConfig.split('\n').forEach(line => {
        const [key, value] = line.split('=')
        if (key && value) {
            // Remove quotes if present
            const cleanValue = value.trim().replace(/^["']|["']$/g, '')
            process.env[key.trim()] = cleanValue
        }
    })
}

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function main() {
    console.log('🧪 Injecting Test Documents for Expiry Logic...')

    const { data: { users }, error: userError } = await supabase.auth.admin.listUsers()
    if (userError || !users || users.length === 0) {
        console.error('No users found to test with.')
        return
    }

    const userId = users[0].id
    console.log(`Using User: ${users[0].email} (${userId})`)

    // Dates
    const today = new Date()

    // 1. Expiring Soon (50 days from now)
    const expiringDate = new Date()
    expiringDate.setDate(today.getDate() + 50)

    // 2. Expired (10 days ago)
    const expiredDate = new Date()
    expiredDate.setDate(today.getDate() - 10)

    // 3. Valid (200 days from now)
    const validDate = new Date()
    validDate.setDate(today.getDate() + 200)

    const docs = [
        {
            user_id: userId,
            category: 'CIPC',
            doc_type: 'cipc_cert',
            title: 'Test Expiring Soon.pdf',
            file_name: 'Test Expiring Soon.pdf',
            status: 'valid', // It is valid, but expiring
            expiry_date: expiringDate.toISOString(),
            metadata: {}
        },
        {
            user_id: userId,
            category: 'SARS',
            doc_type: 'sars_pin',
            title: 'Test Expired.pdf',
            file_name: 'Test Expired.pdf',
            status: 'expired',
            expiry_date: expiredDate.toISOString(),
            metadata: {}
        },
        {
            user_id: userId,
            category: 'COID',
            doc_type: 'coid_letter', // Assuming this type exists
            title: 'Test Healthy.pdf',
            file_name: 'Test Healthy.pdf',
            status: 'valid',
            expiry_date: validDate.toISOString(),
            metadata: {}
        }
    ]

    // Clear existing for clarity
    await supabase.from('compliance_documents').delete().eq('user_id', userId)

    const { error } = await supabase.from('compliance_documents').insert(docs)

    if (error) {
        console.error('Failed to insert test docs:', error)
    } else {
        console.log('✅ Success! Added 3 documents:')
        console.log(`   1. CIPC: Expiring in 50 days (Should show Amber Warning + Dot)`)
        console.log(`   2. SARS: Expired 10 days ago (Should show Red + Text)`)
        console.log(`   3. COID: Healthy (Should show Green)`)
        console.log('\n👉 Please refresh the Compliance page in your browser.')
    }
}

main()
