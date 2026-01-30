// notifications/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface NotificationPayload {
    type: 'INSERT' | 'UPDATE' | 'DELETE'
    table: string
    record: any
    schema: string
}

Deno.serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    // Debug Log: Start
    console.log("🔔 Notification Request Received")

    try {
        // 1. Initialize Supabase Client
        const supabaseUrl = Deno.env.get('SUPABASE_URL')
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

        if (!supabaseUrl || !supabaseKey) {
            console.error("❌ Missing Supabase URL or Key")
            throw new Error("Server Configuration Error")
        }

        const supabaseClient = createClient(supabaseUrl, supabaseKey)

        // 2. Parse Payload
        let payload: NotificationPayload
        try {
            payload = await req.json()
            console.log("📦 Payload:", JSON.stringify(payload))
        } catch (e) {
            console.error("❌ Failed to parse JSON body:", e)
            return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: corsHeaders })
        }

        const { table, record, type } = payload

        if (type !== 'INSERT') {
            console.log("ℹ️ Skipping non-INSERT event")
            return new Response(JSON.stringify({ status: 'skipped', reason: 'not_insert' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        let shouldSend = false
        let subject = ""
        let body = ""

        // 3. Logic for Client Messages (Feedback)
        if (table === 'user_feedback') {
            const userId = record.user_id
            console.log(`🔎 Processing Feedback for User ID: ${userId}`)

            // Fetch user profile to get Tier
            const { data: profile, error } = await supabaseClient
                .from('profiles')
                .select('tier, company_name, full_name')
                .eq('id', userId)
                .single()

            if (error || !profile) {
                console.log("⚠️ Profile not found, skipping.")
                return new Response(JSON.stringify({ status: 'skipped', reason: 'profile_not_found' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
            }

            const tier = profile.tier?.toLowerCase() || ''

            // Check Tier Threshold
            const isTier2 = tier.includes('tier 2')
            const isTier3 = tier.includes('tier 3')

            if (isTier2 || isTier3) {
                shouldSend = true
                const prefix = isTier3 ? '[URGENT | TIER 3]' : '[TIER 2]'
                subject = `${prefix} Client Message: ${profile.company_name || 'Unknown Company'}`
            } else {
                console.log(`ℹ️ Skipping notification for ${tier} client.`)
                return new Response(JSON.stringify({ status: 'skipped', reason: 'tier_threshold' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
            }

            body = `
Event Type: Client Message (Feedback)
Company: ${profile.company_name}
Client Tier: ${profile.tier}
User: ${profile.full_name || 'N/A'}
Timestamp: ${new Date().toISOString()}

Summary:
${record.message}

Rating: ${record.rating}/5
`
        }

        // 4. Logic for System Errors
        if (table === 'error_logs') {
            const severity = record.severity?.toLowerCase() || ''

            if (severity === 'critical' || severity === 'red') {
                shouldSend = true
                subject = `[CRITICAL | SYSTEM ERROR] ${record.page || 'System'} – ${record.description?.substring(0, 50)}...`

                body = `
Event Type: Critical System Error
Severity: ${record.severity.toUpperCase()}
Timestamp: ${new Date().toISOString()}

Error Summary:
${record.description}

Page/Context: ${record.page}
`
            } else {
                return new Response(JSON.stringify({ status: 'skipped', reason: 'severity_threshold' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
            }
        }

        // 5. Send Email (Targeted)
        if (shouldSend) {
            console.log("🚀 Determining recipients based on preferences...")

            // A. Fetch all Admin Profiles
            const { data: adminProfiles, error: adminError } = await supabaseClient
                .from('profiles')
                .select('id, notify_email_tier_support, notify_email_critical_errors')
                .eq('is_admin', true)

            if (adminError || !adminProfiles) {
                console.error("❌ Failed to fetch admins:", adminError)
                return new Response(JSON.stringify({ error: "DB Error" }), { status: 500, headers: corsHeaders })
            }

            // B. Filter Recipients
            const recipientIds: string[] = []

            for (const admin of adminProfiles) {
                if (table === 'user_feedback' && admin.notify_email_tier_support) {
                    recipientIds.push(admin.id)
                }
                else if (table === 'error_logs' && admin.notify_email_critical_errors) {
                    recipientIds.push(admin.id)
                }
            }

            if (recipientIds.length === 0) {
                console.log("ℹ️ No admins have opted in for this alert type. Skipping.")
                return new Response(JSON.stringify({ status: 'skipped', reason: 'no_subscribers' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
            }

            console.log(`📧 Sending to ${recipientIds.length} admins...`)

            // C. Resolve Emails (using Auth Admin API)
            // Note: In production, better to have a materialized view or cache. 
            // For now, we list users or iterate since admins are few.
            const recipients: string[] = []

            for (const uid of recipientIds) {
                const { data: { user }, error: userError } = await supabaseClient.auth.admin.getUserById(uid)
                if (user && user.email) {
                    recipients.push(user.email)
                }
            }

            if (recipients.length === 0) {
                console.error("❌ No valid email addresses found for target admins.")
                return new Response(JSON.stringify({ error: "No Recipients" }), { status: 500, headers: corsHeaders })
            }

            // D. Send via Resend
            const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
            if (!RESEND_API_KEY) {
                console.error("❌ Missing Resend Config")
                return new Response(JSON.stringify({ error: "Configuration Missing" }), { status: 500, headers: corsHeaders })
            }

            const res = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${RESEND_API_KEY}`
                },
                body: JSON.stringify({
                    from: 'Tender Engine System <system@tenderengine.co.za>',
                    to: recipients, // Sends to all valid admins
                    subject: subject,
                    text: body
                })
            })

            const data = await res.json()
            console.log("✅ Resend Response:", JSON.stringify(data))

            if (!res.ok) {
                console.error("❌ Resend API Error:", data)
                return new Response(JSON.stringify({ error: "Resend Failed", details: data }), { status: 500, headers: corsHeaders })
            }

            return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        return new Response(JSON.stringify({ status: 'ok', msg: 'No conditions met' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })


    } catch (error) {
        console.error("💀 Uncaught Exception:", error)
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
    }
})
