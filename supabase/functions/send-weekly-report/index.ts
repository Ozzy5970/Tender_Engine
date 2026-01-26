import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from "../_shared/cors.ts"

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // Info: We use Service Role Key here because we are accessing a global admin view
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        console.log("[Reporting] Generating Weekly Summary...")

        // 1. Fetch Stats
        const { data: stats, error } = await supabase
            .from('weekly_stats_view')
            .select('*')
            .single()

        if (error) throw error

        // 2. Format Report
        const reportMarkdown = `
    # 📊 Weekly Tender Engine Report
    **Period:** Last 7 Days
    
    ## 📈 Activity
    - **New Tenders Processed:** ${stats.new_tenders_count}
    - **Pass Rate:** ${stats.compliant_count} Compliant / ${stats.non_compliant_count} Failed
    
    ## 🤖 AI System Health
    - **Successful Drafts:** ${stats.ai_success_count}
    - **Safety Fallbacks:** ${stats.ai_failure_count}
    - **Model Reliability:** ${stats.ai_success_count + stats.ai_failure_count > 0
                ? Math.round((stats.ai_success_count / (stats.ai_success_count + stats.ai_failure_count)) * 100)
                : 100
            }%
    
    ## ⚠️ Action Items
    - [ ] Check system alerts (if any CRITICAL logs exists)
    `

        // 3. Send Email (Mocked)
        // In production, we would use: await fetch('https://api.resend.com/emails', ...)
        console.log("---------------------------------------------------")
        console.log("SENDING EMAIL TO FOUNDER (admin@company.com):")
        console.log(reportMarkdown)
        console.log("---------------------------------------------------")

        // 4. Log the Run
        await supabase.from('audit_logs').insert({
            action: 'REPORT_SENT',
            details: { stats },
            severity: 'INFO'
        })

        return new Response(
            JSON.stringify({ success: true, report: reportMarkdown }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        )

    } catch (error) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        )
    }
})
