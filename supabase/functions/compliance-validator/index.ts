import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createAdminSupabaseClient } from "../_shared/supabaseClient.ts"
import { corsHeaders } from "../_shared/cors.ts"

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabase = createAdminSupabaseClient()
        const { tender_id } = await req.json()

        if (!tender_id) throw new Error('Missing tender_id')

        console.log(`[Validator] Starting compliance check for tender: ${tender_id}`)

        // 1. FETCH DATA
        // Get Tender Rules
        const { data: rules, error: rulesError } = await supabase
            .from('compliance_requirements')
            .select('*')
            .eq('tender_id', tender_id)

        if (rulesError || !rules) throw new Error('Failed to fetch rules')

        // Get Tender Metadata (need owner user_id to find profile)
        const { data: tender, error: tenderError } = await supabase
            .from('tenders')
            .select('user_id')
            .eq('id', tender_id)
            .single()

        if (tenderError || !tender) throw new Error('Tender not found')

        // Get User Profile & Docs
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*, company_documents(*)')
            .eq('id', tender.user_id)
            .single()

        if (profileError || !profile) throw new Error('Profile not found')

        // 2. RUN CHECKS
        const checksToInsert = []
        let passedCount = 0
        let killerFailed = false

        for (const rule of rules) {
            let status = 'FAIL'
            let reason = 'Requirement not met'
            let actual = {}

            if (rule.rule_category === 'CIDB') {
                // Logic: Check if Profile Grade >= Rule Grade
                // Rule: { grade: 6, class: 'GB' }
                const requiredGrade = rule.target_value.grade
                const requiredClass = rule.target_value.class

                const profileGrade = profile.cidb_grade_grading
                const profileClass = profile.cidb_grade_class

                actual = { grade: profileGrade, class: profileClass }

                if (profileClass === requiredClass && profileGrade >= requiredGrade) {
                    status = 'PASS'
                    reason = 'Grade is sufficient'
                } else {
                    reason = `Required ${requiredGrade}${requiredClass}, Found ${profileGrade}${profileClass}`
                }
            }
            else if (rule.rule_category === 'MANDATORY_DOC') {
                // Logic: Check if doc exists and not expired
                const reqType = rule.target_value.doc_type
                const doc = profile.company_documents.find((d: any) => d.doc_type === reqType)

                if (doc) {
                    actual = { found: true, expiry: doc.expiry_date }
                    // Check expiry (Mock date check)
                    const today = new Date()
                    const expiry = new Date(doc.expiry_date)
                    if (expiry > today) {
                        status = 'PASS'
                        reason = 'Document valid'
                    } else {
                        reason = 'Document expired'
                    }
                } else {
                    actual = { found: false }
                    reason = 'Document missing'
                }
            }

            // Record Result
            if (status === 'PASS') passedCount++
            if (status === 'FAIL' && rule.is_killer) killerFailed = true

            checksToInsert.push({
                tender_id,
                requirement_id: rule.id,
                status,
                actual_value: actual,
                failure_reason: reason
            })
        }

        // 3. PERSIST CHECKS
        // Clean old checks first (simple V1 approach)
        await supabase.from('compliance_checks').delete().eq('tender_id', tender_id)
        await supabase.from('compliance_checks').insert(checksToInsert)

        // 4. CALCULATE AGGREGATE SCORE
        const totalRules = rules.length
        const score = totalRules > 0 ? Math.round((passedCount / totalRules) * 100) : 0

        let readiness = 'GREEN'
        if (killerFailed) readiness = 'RED'
        else if (score < 100) readiness = 'AMBER'

        // 5. UPDATE TENDER STATUS
        await supabase
            .from('tenders')
            .update({
                compliance_score: score,
                readiness: readiness,
                status: readiness === 'RED' ? 'NON_COMPLIANT' : 'COMPLIANT'
            })
            .eq('id', tender_id)

        // 6. LOG
        await supabase.from('audit_logs').insert({
            tender_id,
            action: 'VALIDATION_COMPLETE',
            details: { score, readiness },
            severity: readiness === 'RED' ? 'WARN' : 'INFO'
        })

        return new Response(
            JSON.stringify({
                success: true,
                readiness,
                score,
                checks: checksToInsert
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        )

    } catch (error) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        )
    }
})
