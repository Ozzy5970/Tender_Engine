import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createAdminSupabaseClient } from "../_shared/supabaseClient.ts"
import { generateText } from "../_shared/aiService.ts"
import { corsHeaders } from "../_shared/cors.ts"

// --- SAFETY CONFIGURATION ---
const SAFETY_CONFIG = {
    MIN_CONFIDENCE: 50,
    PROHIBITED_PHRASES: [/as mentioned in project/i, /guaranteed win/i, /bribe/i],
    MAX_PLACEHOLDERS: 5
}

// Static Fallback Template (simplified for V1)
const FALLBACK_TEMPLATE = `
# Method Statement (Template)

**Note:** AI generation was unavailable or unsafe. Please edit this standard template.

## 1. Scope of Works
[Insert Scope Here]

## 2. Resources
- Plant: [List Plant]
- Labor: [List Team]

## 3. Methodology
The works will be executed in accordance with SANS 1200...
`

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabase = createAdminSupabaseClient()
        const { tender_id, section_name, prompt } = await req.json()

        if (!tender_id || !section_name) {
            throw new Error('Missing tender_id or section_name')
        }

        console.log(`[AI-Draft] Generating '${section_name}' for tender: ${tender_id}`)

        // 1. FETCH CONTEXT & VALIDATE INPUT
        const { data: tender, error: fetchError } = await supabase
            .from('tenders')
            .select('title, client_name, user_id')
            .eq('id', tender_id)
            .single()

        if (fetchError || !tender) throw new Error('Tender context not found')

        const { data: profile } = await supabase
            .from('profiles')
            .select('company_name')
            .eq('id', tender.user_id)
            .single()

        const companyName = profile?.company_name || "The Contractor"

        // 2. CONSTRUCT STRICT SYSTEM PROMPT
        const systemPrompt = `
      You are the Tender Compliance Assistant for ${companyName}.
      Your Role: Draft technical method statements for construction tenders.

      STRICT CONSTRAINTS:
      1. SOURCE TRUTH: Use the provided context. Do NOT invent specific stats (e.g., "Crane tonnage").
      2. NO HALLUCINATIONS: If a detail is missing, write "[[REQUIRES INPUT: <Detail>]]".
      3. OUTPUT FORMAT: Return ONLY a valid JSON object.
      
      JSON SCHEMA:
      {
        "content_markdown": "string (markdown formatted)",
        "confidence_score": number (0-100),
        "missing_data": ["string"]
      }
    `

        const userContext = `
      Project: ${tender.title}
      Client: ${tender.client_name || 'Generic Client'}
      Section: ${section_name}
      User Instruction: ${prompt || 'Standard professional draft'}
    `

        // 3. GENERATE CONTENT
        let result = {
            content: FALLBACK_TEMPLATE,
            status: 'DRAFT_MANUAL_EDIT', // Start assuming fallback
            notes: 'Fallback used',
            score: 0
        }

        try {
            const aiResponse = await generateText(userContext, systemPrompt)

            // Attempt to parse JSON
            // Note: In a real implementation we'd use a robust JSON parser or retry logic
            // For this V1, we assume the Mock/AI returns valid JSON if we asked nicely.
            // Since our Mock in aiService returns text, we need to adapt it here.

            // MOCK ADAPTER for V1 (simulating the AI returning JSON)
            // If the aiService returned a string that ISN'T JSON, we'd fail here.
            // For now, let's pretend we parsed it, or construct it if it's raw text.
            let parsedAIData;
            try {
                parsedAIData = JSON.parse(aiResponse.text)
            } catch {
                // If raw text came back, wrap it (Handling non-JSON capable models)
                parsedAIData = {
                    content_markdown: aiResponse.text,
                    confidence_score: 80, // Optimistic default for raw text
                    missing_data: []
                }
            }

            // 4. RUN SAFETY GATES
            const { content_markdown, confidence_score, missing_data } = parsedAIData

            // Gate A: Confidence
            if (confidence_score < SAFETY_CONFIG.MIN_CONFIDENCE) {
                throw new Error(`Confidence too low (${confidence_score})`)
            }

            // Gate B: Prohibited Phrases
            for (const regex of SAFETY_CONFIG.PROHIBITED_PHRASES) {
                if (regex.test(content_markdown)) {
                    throw new Error(`Unsafe content detected by regex: ${regex}`)
                }
            }

            // Gate C: Placeholder Overload
            const placeholderCount = (content_markdown.match(/\[\[REQUIRES INPUT/g) || []).length
            if (placeholderCount > SAFETY_CONFIG.MAX_PLACEHOLDERS) {
                // We allow it but flag it
                result.status = 'INCOMPLETE_DATA'
            } else {
                result.status = 'REVIEW_PENDING'
            }

            result.content = content_markdown
            result.score = confidence_score
            result.notes = 'AI Generated successfully'

        } catch (err) {
            console.warn(`[AI Safety] Validation Failed: ${err.message}. Reverting to Template.`)
            // Keep result as Fallback (defined above)
            // Log the specific failure for audit
            result.notes = `Safety Failure: ${err.message}`
        }

        // 5. STORE DRAFT (Optimistic Locking / Versioning)
        const { data: existingDrafts } = await supabase
            .from('ai_drafts')
            .select('version')
            .eq('tender_id', tender_id)
            .eq('section_name', section_name)
            .order('version', { ascending: false })
            .limit(1)

        const nextVersion = (existingDrafts?.[0]?.version || 0) + 1

        const { data: newDraft, error: insertError } = await supabase
            .from('ai_drafts')
            .insert({
                tender_id,
                section_name,
                version: nextVersion,
                content_markdown: result.content,
                status: result.status, // Can be REVIEW_PENDING or DRAFT_MANUAL_EDIT
                user_feedback: result.notes
            })
            .select('id')
            .single()

        if (insertError) throw insertError

        // 6. LOG EVENT
        await supabase.from('audit_logs').insert({
            tender_id,
            action: result.status === 'DRAFT_MANUAL_EDIT' ? 'DRAFT_FALLBACK' : 'DRAFT_GENERATED',
            details: { section: section_name, version: nextVersion, safety_notes: result.notes },
            severity: result.status === 'DRAFT_MANUAL_EDIT' ? 'WARN' : 'INFO'
        })

        return new Response(
            JSON.stringify({
                success: true,
                draft_id: newDraft.id,
                version: nextVersion,
                status: result.status,
                content: result.content
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
