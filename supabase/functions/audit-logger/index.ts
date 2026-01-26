// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createAdminSupabaseClient } from "../_shared/supabaseClient.ts"
import { corsHeaders } from "../_shared/cors.ts"

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabase = createAdminSupabaseClient()
        const { actor_id, tender_id, action, details, severity } = await req.json()

        if (!action) throw new Error('Missing action')

        console.log(`[Audit] ${action} (${severity || 'INFO'})`)

        // 1. INSERT AUDIT LOG
        const logEntry = {
            actor_id: actor_id || null,
            tender_id: tender_id || null,
            action,
            details: details || {},
            severity: severity || 'INFO',
            ip_address: (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || null
        }

        const { error: logError } = await supabase
            .from('audit_logs')
            .insert(logEntry)

        if (logError) throw logError

        // 2. ALERTING LOGIC

        // A. User Alerts (In-App) -> For WARN/ERROR related to Tenders
        if ((severity === 'ERROR' || severity === 'WARN') && tender_id) {
            const { data: tender } = await supabase
                .from('tenders')
                .select('user_id')
                .eq('id', tender_id)
                .single()

            if (tender?.user_id) {
                await supabase.from('alerts').insert({
                    user_id: tender.user_id,
                    tender_id,
                    priority: severity === 'ERROR' ? 'HIGH' : 'MEDIUM',
                    message: `Alert: ${action}. Check details.`,
                    is_read: false
                })
            }
        }

        // B. Founder Alerts (System Level) -> For CRITICAL
        if (severity === 'CRITICAL') {
            // SIMULATE PAGERDUTY / TWILIO SMS
            console.error("!!! CRITICAL SYSTEM ALERT TRIGGERED !!!")
            console.error(`Message: ${action}`)
            console.error(`Details: ${JSON.stringify(details)}`)
            console.error("Sending SMS to Founder...")
            // Logic: await fetch('twilio-api', ...)
        }

        return new Response(
            JSON.stringify({ logged: true }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        )

    } catch (error) {
        return new Response(
            JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        )
    }
})
