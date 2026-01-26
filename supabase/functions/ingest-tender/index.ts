import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createAdminSupabaseClient } from "../_shared/supabaseClient.ts"
import { corsHeaders } from "../_shared/cors.ts"

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabase = createAdminSupabaseClient()
        const { tender_id, file_path, file_name } = await req.json()

        if (!tender_id || !file_path) {
            throw new Error('Missing tender_id or file_path')
        }

        console.log(`[Ingest] Processing file: ${file_name} for tender: ${tender_id}`)

        // 1. SIMULATE OCR / TEXT EXTRACTION
        // In production, this would call Unstructured.io or Textract
        const simulated_text = `
      TENDER SPECIFICATION: ${file_name}
      CLOSING DATE: 2024-12-30
      REQUIRED CIDB GRADE: 6GB
      MANDATORY: TAX CLEARANCE, COID
    `

        const simulated_metadata = {
            detected_closing_date: "2024-12-30",
            detected_cidb_grade: "6GB",
            page_count: 45
        }

        // 2. UPDATE DOCUMENT WITH EXTRACTION
        const { error: updateError } = await supabase
            .from('tender_documents')
            .update({
                extracted_text: simulated_text,
                metadata: simulated_metadata,
                doc_category: 'TENDER_SPEC' // Defaulting for V1
            })
            .eq('tender_id', tender_id)
            .eq('file_path', file_path)

        // Note: If the document doesn't exist yet (race condition), we might need to insert. 
        // For this V1, we assume the upload record creation handled the initial insert 
        // or we do an upsert here. Let's do an upsert to be safe.

        const { error: upsertError } = await supabase
            .from('tender_documents')
            .upsert({
                tender_id,
                file_path,
                file_name: file_name || 'unknown.pdf',
                extracted_text: simulated_text,
                metadata: simulated_metadata,
                doc_category: 'TENDER_SPEC'
            }, { onConflict: 'tender_id, file_path' }) // Assuming unique constraint or logic

        if (upsertError) throw upsertError

        // 3. AUTO-EXTRACT COMPLIANCE REQUIREMENTS (Mock Logic)
        // We populate the compliance_requirements table based on what we "found"
        const rulesToInsert = [
            {
                tender_id,
                rule_category: 'CIDB',
                target_value: { grade: 6, class: 'GB' },
                description: 'Must have CIDB Grade 6GB or higher',
                is_killer: true
            },
            {
                tender_id,
                rule_category: 'MANDATORY_DOC',
                target_value: { doc_type: 'TAX_CLEARANCE' },
                description: 'Valid Tax Clearance Certificate required',
                is_killer: true
            }
        ]

        const { error: rulesError } = await supabase
            .from('compliance_requirements')
            .insert(rulesToInsert)

        if (rulesError) console.error("Error inserting rules:", rulesError)

        // 4. TRIGGER ANALYSIS (Async via Audit Log or Direct)
        // We'll log that ingestion is done, which could trigger the validator
        await supabase.from('audit_logs').insert({
            tender_id,
            action: 'INGEST_COMPLETE',
            details: { file_name, extracted: true }
        })

        return new Response(
            JSON.stringify({ success: true, message: "Ingestion and Rule Extraction Complete" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        )

    } catch (error) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        )
    }
})
