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
            console.log(`👤 User Tier: ${tier}`)

            const isTier2 = tier.includes('tier 2')
            const isTier3 = tier.includes('tier 3')

            if (isTier2) {
                shouldSend = true
                subject = `[TIER 2 | CLIENT MESSAGE] ${profile.company_name || 'Unknown Company'} – New Feedback`
            } else if (isTier3) {
                shouldSend = true
                subject = `[TIER 3 | URGENT | CLIENT MESSAGE] ${profile.company_name || 'Unknown Company'} – New Feedback`
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

Action Required:
Review client query in Admin Feedback dashboard.
`
        }

        // 4. Logic for System Errors
        if (table === 'error_logs') {
            const severity = record.severity?.toLowerCase() || ''
            console.log(`🔎 Processing Error with Severity: ${severity}`)

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

Action Required:
Investigate immediately via console or Admin Errors dashboard.
`
            } else {
                console.log(`ℹ️ Skipping notification for ${severity} error.`)
                return new Response(JSON.stringify({ status: 'skipped', reason: 'severity_threshold' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
            }
        }

        // 5. Send Email
        if (shouldSend) {
            console.log("🚀 Attempting to send email via Resend...")
            const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
            const ADMIN_EMAIL = Deno.env.get('ADMIN_EMAIL')

            if (!RESEND_API_KEY || !ADMIN_EMAIL) {
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
                    from: 'Antigravity System <onboarding@resend.dev>',
                    to: ADMIN_EMAIL,
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
