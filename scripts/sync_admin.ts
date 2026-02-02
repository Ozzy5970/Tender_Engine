
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

const ADMIN_ID = 'faaaf0ba-77d3-4411-b3c7-21bf04b55400'

async function sync() {
    console.log(`Syncing admin ${ADMIN_ID}...`)

    // 1. Ensure Profile is marked as Admin
    const { error: pError } = await supabase
        .from('profiles')
        .update({ is_admin: true })
        .eq('id', ADMIN_ID)

    if (pError) console.error("Profile update error:", pError.message)
    else console.log("Profile marked as admin.")

    // 2. Insert into admins table
    // If the trigger is active, step 1 might have done this. But let's be sure.
    const { error: aError } = await supabase
        .from('admins')
        .insert({ id: ADMIN_ID })

    if (aError) {
        if (aError.code === '23505') console.log("Admin already in admins table (Duplicate).")
        else console.error("Admins table insert error:", aError.message)
    } else {
        console.log("Successfully inserted into admins table.")
    }
}

sync()
