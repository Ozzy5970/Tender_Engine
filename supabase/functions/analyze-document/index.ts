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
        const supabaseUrl = Deno.env.get('SUPABASE_URL') || Deno.env.get('PROJECT_URL') || ''
        const supabaseKey = Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
        const geminiKey = Deno.env.get('GEMINI_API_KEY')

        // 🔍 Debugging: Fail fast if secrets are missing
        if (!supabaseUrl) throw new Error('System Configuration Error: Missing SUPABASE_URL (or PROJECT_URL).')
        if (!supabaseKey) throw new Error('System Configuration Error: Missing SERVICE_ROLE_KEY.')
        if (!geminiKey) throw new Error('System Configuration Error: Missing GEMINI_API_KEY.')

        const supabaseClient = createClient(supabaseUrl, supabaseKey)

        // 2. Download File from Storage
        // Try 'compliance' bucket first (default), maybe 'templates' if checking there?
        // Note: The frontend code uploads to 'compliance' bucket in 'temp/...' path for analysis.
        // So we look in 'compliance'.
        const { data: fileData, error: downloadError } = await supabaseClient
            .storage
            .from('compliance')
            .download(file_path)

        if (downloadError) {
            console.error("Download Error:", downloadError)
            throw new Error(`Failed to download file: ${downloadError.message}`)
        }

        // 3. Prepare for Gemini
        const arrayBuffer = await fileData.arrayBuffer()
        const base64Data = btoa(
            new Uint8Array(arrayBuffer)
                .reduce((data, byte) => data + String.fromCharCode(byte), '')
        );

        // 4. Define Prompt
        // 4. Define Prompt with Strict Validation
        let promptText = "";

        // Extract validation rules if provided in the body
        // @ts-ignore
        const validationRules = body.validationRules || {};

        promptText = `
        You are a STRICTOR Compliance Officer for South African Construction Tenders.
        Your GOAL: Validate if this document is EXACTLY what is claimed and extract data.

        CLAIMED DOCUMENT TYPE: "${doc_type}"
        VALIDATION RULES: ${JSON.stringify(validationRules)}

        INSTRUCTIONS:
        1. **CLASSIFY**: Does this document match the claimed type? 
           - If it is a generic invoice but claimed to be a "Tax Clearance", it is INVALID.
           - If it is a blank form but claimed to be a "Certificate", it is INVALID.
           - If it is readable but wrong type, return "valid": false.

        2. **EXTRACT**: Extract fields as per standard requirements for this doc type.
           - Look for Expiry Dates.
           - Look for Reference Numbers (Tax PIN, CSD MAAA, CIDB CRS).

        3. **VALIDATE**: 
           - Check if extracted numbers match the regex rules provided (if any).
           - If a "required" field is missing (e.g. Expiry Date on a Tax Clearance), mark as "valid": false (or warning if it might be valid but just missing data).
           - "valid" should be boolean. TRUE = Definite match. FALSE = Definite mismatch or critical missing info.

        RETURN JSON FORMAT ONLY:
        {
          "valid": boolean,
          "confidence": number, // 0-100
          "reason": "Short explanation of validity judgment",
          "doc_type_detected": "What you think it is",
          "expiry_date": "YYYY-MM-DD" or null,
          "reference_number": "Main extracted ID" or null,
          "min_bbbee_level": "number e.g. 1",
          "summary": "Brief 2 sentence summary of scope",
          "risks": ["Risk 1", "Risk 2"],
          "strategic_value": "High/Medium/Low",
          "strategy_tips": "One key tip to win this bid"
        }

        Rules:
        - If CIDB is not found, guess based on scope or null.
        - 'risks': Look for high penalties, short deadlines, or complex requirements.
        - 'strategy_tips': Based on the scope, what should the bidder focus on?
        - 'strategic_value': High if budget seems >R10m, Low if <R1m. Guess based on scope.
        `
        "warnings": ["Array of text warnings..."]
    }
        `;

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
