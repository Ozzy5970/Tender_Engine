import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
    // Top-level Error Handling to prevent "non-2xx" generic errors
    try {
        // Handle CORS preflight
        if (req.method === 'OPTIONS') {
            return new Response('ok', { headers: corsHeaders })
        }

        // Health Check
        if (req.method === 'GET') {
            return new Response(JSON.stringify({ status: 'active', message: 'Analyze Document Function is running' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        const body = await req.json().catch(() => null)
        if (!body) {
            throw new Error('Invalid Request Body')
        }
        const { file_path, doc_type } = body

        if (!file_path || !doc_type) {
            throw new Error(`Missing required fields: file_path=${file_path}, doc_type=${doc_type}`)
        }

        // 1. Initialize Clients (With Safe Fallbacks)
        // 1. Initialize Clients (With Safe Fallbacks)
        const supabaseUrl = Deno.env.get('SUPABASE_URL') || Deno.env.get('PROJECT_URL') || ''
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
        const geminiKey = Deno.env.get('GEMINI_API_KEY')

        // 🔍 Debugging: Fail fast if secrets are missing
        if (!supabaseUrl) throw new Error('System Configuration Error: Missing SUPABASE_URL.')
        if (!supabaseAnonKey) throw new Error('System Configuration Error: Missing SUPABASE_ANON_KEY.')
        if (!geminiKey) throw new Error('System Configuration Error: Missing GEMINI_API_KEY.')

        // SECURITY FIX: Use the User's JWT (Auth Header) to respect RLS
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) {
            throw new Error('Unauthorized: Missing Authorization Header')
        }

        // Create client scoped to the user
        const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: authHeader } }
        })

        // 2. FETCH PROFILE (For Cross-Referencing)
        const { data: profile, error: profileError } = await supabaseClient
            .from('profiles')
            .select('company_name, registration_number, tax_reference_number, full_name')
            .single()

        const profileData = profile || {}
        console.log(`[AI] Cross-referencing against profile: ${JSON.stringify(profileData)}`)

        // 3. Download File from Storage
        const { data: fileData, error: downloadError } = await supabaseClient
            .storage
            .from('compliance')
            .download(file_path)

        if (downloadError) {
            console.error("Download Error:", downloadError)
            throw new Error(`Failed to download file: ${downloadError.message}`)
        }

        // 4. Prepare for Gemini
        const arrayBuffer = await fileData.arrayBuffer()
        const base64Data = btoa(
            new Uint8Array(arrayBuffer)
                .reduce((data, byte) => data + String.fromCharCode(byte), '')
        );

        // 5. Define Prompt with CROSS-REFERENCING
        // Extract validation rules if provided in the body
        // @ts-ignore
        const validationRules = body.validationRules || {};

        const promptText = `
        You are a STRICTOR Compliance Officer for South African Construction Tenders.
        Your GOAL: Validate if this document is EXACTLY what is claimed and CROSS-REFERENCE it against the user's profile.

        CLAIMED DOCUMENT TYPE: "${doc_type}"
        USER PROFILE DATA (FOR COMPARISON):
        - Company Name: "${profileData.company_name}"
        - Full Name: "${profileData.full_name}"
        - Registration No: "${profileData.registration_number}"
        - Tax Reference No: "${profileData.tax_reference_number}"

        VALIDATION RULES: ${JSON.stringify(validationRules)}

        INSTRUCTIONS:
        1. **CLASSIFY**: Does this document match the claimed type? 
        2. **CROSS-REFERENCE**: 
           - Does the Company Name on the document match "${profileData.company_name}"?
           - Does the Registration Number match "${profileData.registration_number}"?
           - Does the Tax Number match "${profileData.tax_reference_number}"?
           - If there is a SIGNIFICANT mismatch (e.g. different company name), return "valid": false and state "Mismatched Company Identity" in reason.

        3. **EXTRACT**: Extract fields.
           - Look for Expiry Dates.
           - Look for Reference Numbers.

        4. **VALIDATE**: 
           - If a "required" field is missing or expired, mark as "valid": false.
           - "valid" should be boolean.

        RETURN JSON FORMAT ONLY:
        {
          "valid": boolean,
          "confidence": number, // 0-100
          "reason": "Short explanation of validity/mismatch judgment",
          "doc_type_detected": "What you think it is",
          "expiry_date": "YYYY-MM-DD" or null,
          "reference_number": "Main extracted ID" or null,
          "summary": "Brief 2 sentence summary",
          "risks": ["Risk 1", "Risk 2"],
          "strategic_value": "High/Medium/Low",
          "strategy_tips": "One key tip"
        }
        `


        // 5. Dynamic Model Discovery (Fix for Region/Account 404s)
        const discoveryUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}`
        const discoveryResp = await fetch(discoveryUrl);

        let targetModel = 'models/gemini-1.5-flash'; // Default fallback
        let availableModels: any[] = [];

        if (discoveryResp.ok) {
            const discoveryJson = await discoveryResp.json();
            if (discoveryJson.models) {
                // Filter for generating content
                availableModels = discoveryJson.models.filter((m: any) =>
                    m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent')
                );

                console.log("Available Models:", availableModels.map((m: any) => m.name));

                // Preference Logic
                const preferences = [
                    'models/gemini-1.5-flash',
                    'models/gemini-1.5-pro',
                    'models/gemini-1.5-flash-8b',
                    'models/gemini-1.0-pro',
                    'models/gemini-pro'
                ];

                const bestMatch = preferences.find(pref => availableModels.some((m: any) => m.name === pref))
                    || availableModels[0]?.name; // Fallback to first available

                if (bestMatch) {
                    targetModel = bestMatch;
                }
            }
        } else {
            console.error("Model Discovery Failed:", await discoveryResp.text());
            // If discovery fails, we proceed with default fallback, likely throwing 404 again, 
            // but maybe discovery fails due to permissions while specific model works? Unlikely.
        }

        console.log(`Using Model: ${targetModel}`);

        // 6. Call Gemini API
        // Ensure targetModel doesn't double-prefix 'models/' if API returned it
        // The API returns 'models/gemini-pro', but URL expects 'models/gemini-pro:generateContent'
        // Just ensure we don't have 'models/models/...'
        const cleanModelName = targetModel.startsWith('models/') ? targetModel.substring(7) : targetModel;

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModelName}:generateContent?key=${geminiKey}`

        const apiResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: promptText },
                        { inline_data: { mime_type: "application/pdf", data: base64Data } }
                    ]
                }]
            })
        })

        if (!apiResponse.ok) {
            const errorText = await apiResponse.text()
            // Includes info about available models if 404
            throw new Error(`Gemini API Error (Model: ${cleanModelName}, Status: ${apiResponse.status}): ${errorText}`)
        }

        const result = await apiResponse.json()

        // Parse Result
        // Structure: result.candidates[0].content.parts[0].text
        const text = result.candidates?.[0]?.content?.parts?.[0]?.text
        if (!text) throw new Error("AI returned empty response")

        const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();

        let parsedData;
        try {
            parsedData = JSON.parse(cleanJson);
        } catch (jsonErr) {
            console.error("JSON Parse Error:", text)
            // Try to find JSON object if mixed with text
            const firstBrace = text.indexOf('{')
            const lastBrace = text.lastIndexOf('}')
            if (firstBrace >= 0 && lastBrace > firstBrace) {
                try {
                    parsedData = JSON.parse(text.substring(firstBrace, lastBrace + 1))
                } catch {
                    throw new Error("Failed to parse AI response as JSON")
                }
            } else {
                throw new Error("Failed to parse AI response as JSON")
            }
        }

        // Check if Gemini returned an error structure within its JSON
        if (parsedData && typeof parsedData === 'object' && 'error' in parsedData) {
            throw new Error(`AI Response Error: ${JSON.stringify(parsedData.error)}`);
        }

        return new Response(
            JSON.stringify(parsedData),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )

    } catch (error: any) {
        // CRITICAL: Return 200 OK so the client can read the error message
        return new Response(
            JSON.stringify({
                error: error.message,
                stack: error.stack,
                details: "Edge Function Error Catch"
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200
            }
        )
    }
})
