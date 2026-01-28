
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

console.log("CWD:", process.cwd())
const r1 = dotenv.config({ path: '.env' })
console.log("Local .env:", r1.error ? r1.error.message : "Loaded")
const r2 = dotenv.config({ path: '../.env' })
console.log("Root .env:", r2.error ? r2.error.message : "Loaded")

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY // Needed to simulate user or bypass RLS if strictly needed, but let's try to mimic user flow if possible. 
// Actually, to test RLS properly we should ideally sign in. But for a quick backend check, we can use service role to act as admin or just test the DB constraints.
// Let's use Service Role to ensure we can read/write without auth flow complexity in a script.

console.log("URL:", process.env.VITE_SUPABASE_URL ? "OK" : "MISSING")
console.log("SERVICE:", process.env.SUPABASE_SERVICE_ROLE_KEY ? "OK" : "MISSING")

if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey)

async function runProfileTest() {
    console.log("Starting Profile Section Test...")

    // 1. Get a Test User (or create one, but let's grab the first one found)
    const { data: users, error: userError } = await supabase.auth.admin.listUsers()
    if (userError || !users.users.length) {
        console.error("Failed to list users:", userError)
        return
    }

    const testUser = users.users[0]
    console.log(`Testing with User ID: ${testUser.id}`)

    // 2. Read Initial Profile
    const { data: initialProfile, error: readError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', testUser.id)
        .single()

    if (readError) {
        console.error("Failed to read profile:", readError)
        // If no profile, try creating one? (Though app does this on signup)
        return
    }

    console.log("Initial Profile State:", {
        full_name: initialProfile.full_name,
        location: initialProfile.location,
        company_name: initialProfile.company_name
    })

    // 3. Update Profile Data
    const updatePayload = {
        full_name: `Test User ${new Date().getTime()}`,
        location: 'Test City, South Africa',
        phone: '+27 82 000 0000',
        updated_at: new Date().toISOString(),
        company_name: 'Test Corp Ltd',
        registration_number: '2023/123456/07',
        tax_reference_number: '9123456789'
    }

    console.log("Attempting Update with:", updatePayload)

    const { error: updateError } = await supabase
        .from('profiles')
        .update(updatePayload)
        .eq('id', testUser.id)

    if (updateError) {
        console.error("Update Failed:", updateError)
        return
    }

    console.log("Update Command Sent. Verifying persistence...")

    // 4. Verify Update
    const { data: updatedProfile, error: verifyError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', testUser.id)
        .single()

    if (verifyError) {
        console.error("Verification Read Failed:", verifyError)
        return
    }

    // Check fields
    let passed = true
    if (updatedProfile.full_name !== updatePayload.full_name) {
        console.error(`FAIL: full_name mismatch. Expected '${updatePayload.full_name}', got '${updatedProfile.full_name}'`)
        passed = false
    }
    if (updatedProfile.location !== updatePayload.location) {
        console.error(`FAIL: location mismatch.`)
        passed = false
    }
    if (updatedProfile.company_name !== updatePayload.company_name) {
        console.error(`FAIL: company_name mismatch. Expected '${updatePayload.company_name}', got '${updatedProfile.company_name}'`)
        passed = false
    }
    if (updatedProfile.registration_number !== updatePayload.registration_number) {
        console.error(`FAIL: registration_number mismatch.`)
        passed = false
    }
    if (updatedProfile.tax_reference_number !== updatePayload.tax_reference_number) {
        console.error(`FAIL: tax_reference_number mismatch.`)
        passed = false
    }

    if (passed) {
        console.log("SUCCESS: Profile Section Test Passed! Data was persisted correctly.")

        // Restore original? Optional, but good practice.
        console.log("Restoring original data...")
        await supabase.from('profiles').update({
            full_name: initialProfile.full_name,
            location: initialProfile.location,
            phone: initialProfile.phone,
            company_name: initialProfile.company_name,
            registration_number: initialProfile.registration_number,
            tax_reference_number: initialProfile.tax_reference_number
        }).eq('id', testUser.id)
        console.log("Restore complete.")
    } else {
        console.error("TEST FAILED: Data mismatch.")
    }
}

runProfileTest()
