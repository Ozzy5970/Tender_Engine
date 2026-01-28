import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

// Load environment variables manually
const envPath = path.resolve(__dirname, '../.env')
if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf-8')
    envConfig.split('\n').forEach(line => {
        const [key, value] = line.split('=')
        if (key && value) {
            const cleanValue = value.trim().replace(/^["']|["']$/g, '')
            process.env[key.trim()] = cleanValue
        }
    })
}

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing credentials')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function main() {
    console.log('🧪 Injecting Dashboard Test Data...')

    // 1. Get User
    const { data: { users } } = await supabase.auth.admin.listUsers()
    if (!users || users.length === 0) { console.error('No users found'); return }
    const userId = users[0].id
    console.log(`Using User: ${users[0].email}`)

    // 2. Clear Existing Data (Tenders & Compliance)
    await supabase.from('tenders').delete().eq('user_id', userId)
    await supabase.from('compliance_documents').delete().eq('user_id', userId)

    // 3. Insert Tenders (To affect Active Tenders, Avg Readiness, Graph, Recent Activity)
    const tenders = [
        { user_id: userId, title: 'Road Upgrade Phase 1', client_name: 'Muni A', status: 'DRAFT', compliance_score: 80, readiness: 'GREEN', updated_at: new Date().toISOString() },
        { user_id: userId, title: 'School Building Block', client_name: 'Dept B', status: 'SUBMITTED', compliance_score: 95, readiness: 'GREEN', updated_at: new Date(Date.now() - 86400000).toISOString() }, // Yesterday
        { user_id: userId, title: 'IT Services Contract', client_name: 'Corp C', status: 'ANALYZING', compliance_score: 40, readiness: 'RED', updated_at: new Date(Date.now() - 172800000).toISOString() }, // 2 days ago
        { user_id: userId, title: 'Security Fencing', client_name: 'Prop D', status: 'DRAFT', compliance_score: 60, readiness: 'AMBER', updated_at: new Date(Date.now() - 259200000).toISOString() }, // 3 days ago
        { user_id: userId, title: 'Cleaning Services', client_name: 'Muni E', status: 'ARCHIVED', compliance_score: 10, readiness: 'RED', updated_at: new Date(Date.now() - 1000000000).toISOString() } // Archived (Should act as ignored)
    ]
    await supabase.from('tenders').insert(tenders)
    console.log('✅ Added 5 Tenders (4 Active, 1 Archived)')

    // 4. Insert Compliance Docs (To affect Compliance Health & Expiry Warning)
    const today = new Date()
    const expiringDate = new Date(); expiringDate.setDate(today.getDate() + 45) // Expiring in 45 days
    const validDate = new Date(); validDate.setDate(today.getDate() + 200)

    const docs = [
        { user_id: userId, category: 'CIPC', doc_type: 'cipc_cert', title: 'CIPC.pdf', file_name: 'CIPC.pdf', status: 'valid', expiry_date: expiringDate.toISOString() },
        { user_id: userId, category: 'SARS', doc_type: 'sars_pin', title: 'SARS.pdf', file_name: 'SARS.pdf', status: 'valid', expiry_date: validDate.toISOString() },
        { user_id: userId, category: 'COID', doc_type: 'coid_letter', title: 'COID.pdf', file_name: 'COID.pdf', status: 'valid', expiry_date: validDate.toISOString() },
        // Missing others will lower the score from 100%
    ]
    await supabase.from('compliance_documents').insert(docs)
    console.log('✅ Added 3 Compliance Docs (1 Expiring Soon)')

    console.log('\n🎉 Dashboard should now show:')
    console.log('   - Avg Readiness: ~69% (Average of 80, 95, 40, 60)')
    console.log('   - Active Tenders: 4')
    console.log('   - Compliance Health: ~33% (3 out of 9 docs)')
    console.log('   - Expiry Warning: "1 document expiring soon"')
    console.log('   - Graph: Populated with blue bars')
    console.log('   - Recent Activity: List of 4 tenders')
}

main()
