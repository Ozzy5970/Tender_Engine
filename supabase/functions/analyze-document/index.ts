import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
    // Top-level Error Handling to prevent "non-2xx" generic errors
    try {
        // Handle CORS preflight
        if (req.method === 'OPTIONS') {
            console.log("[EDGE FUNC PROOF] Received OPTIONS preflight request - returning 200 OK")
            return new Response('ok', { headers: corsHeaders })
        }

        // Health Check
        if (req.method === 'GET') {
            return new Response(JSON.stringify({ status: 'active', message: 'Analyze Document Function is running' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        const body = await req.json().catch(() => null)
        console.log(`[EDGE FUNC PROOF] Started executing main function logic for method: ${req.method}`)

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
        console.log(`[EDGE FUNC PROOF] Authorization header present: ${!!authHeader}`)

        if (!authHeader) {
            throw new Error('Unauthorized: Missing Authorization Header')
        }

        // Parse explicit token for Edge Runtime verification
        const token = authHeader.replace(/^Bearer\s+/i, '').trim()
        if (!token) {
            throw new Error('Unauthorized: Malformed Bearer token')
        }
        console.log(`[EDGE FUNC PROOF] Bearer token extracted (first 10 chars): ${token.substring(0, 10)}...`)

        // Create client scoped to the user
        const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: authHeader } }
        })

        // EXPLICIT AUTH VERIFICATION: Ensure token is deeply valid and not expired
        // Must pass explicit token in Edge Functions because there is no persistent LocalStorage
        const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)
        if (authError || !user) {
            throw new Error(`Unauthorized: Invalid or expired token. ${authError?.message || ''}`)
        }
        console.log(`[EDGE FUNC PROOF] User authenticated ID: ${user.id}`)

        // 2. FETCH PROFILE (For Cross-Referencing)
        const { data: profile, error: profileError } = await supabaseClient
            .from('profiles')
            .select('company_name, registration_number, tax_reference_number, full_name')
            .single()

        console.log(`[EDGE FUNC PROOF] User Verification / Profile fetch completed. Error: ${profileError?.message || 'None'}`);

        const profileData = profile || {}
        console.log(`[AI] Cross-referencing against profile: ${JSON.stringify(profileData)}`)

        // 3. Download File from Storage
        console.log(`[EDGE FUNC PROOF] Attempting to download from bucket 'compliance' with path: ${file_path}`);
        const { data: fileData, error: downloadError } = await supabaseClient
            .storage
            .from('compliance')
            .download(file_path)

        if (downloadError) {
            console.error(`[EDGE FUNC PROOF] Download Failed: ${downloadError.message}`)
            throw new Error(`Failed to download file: ${downloadError.message}`)
        }
        console.log("[EDGE FUNC PROOF] File downloaded successfully, preparing Gemini prompt.")

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
           - For CIPC Certificates, you MUST extract "registration_date" (YYYY-MM-DD).
           - For CIDB Contractor Certificates, you MUST extract:
             - grade: The CIDB contractor grade (a single digit from 1 to 9)
             - class_of_work: The CIDB class of work (e.g. GB, CE, ME, etc.)
             
             These values are typically found:
             - Near the company name
             - In formats such as:
               - '6GB'
               - 'Grade 6 GB'
               - 'CIDB Grade: 6, Class: GB'
             
             If combined (e.g. '6GB'):
             - grade = "6"
             - class_of_work = "GB"
             
             If not found, return null.

           - For B-BBEE Certificates or Affidavits, do NOT only summarize validity.
             You must perform literal field extraction for:
             1. 'issuing_body'
             2. 'certificate_or_affidavit_number'
             Search the FULL page carefully including headers, footers, agency sections, near logos, verification panels, and small text blocks outside the main body.
             These may appear as labels such as: "Issuing body", "Issuer", "Verification agency", "Agency", "Certificate number", "Affidavit number", "Ref number", "Verification number".
             If present anywhere, return the exact visible value. Only return null if the field is truly absent.
             [DEBUG INSTRUCTION]: If you fail to find issuing_body or certificate_or_affidavit_number, but suspect they exist, you MUST mention their values explicitly inside the 'reason' or 'summary' field so we can manually parse them.
           - For Shareholding / Share Certificates, extract the following if present:
             1. 'certificate_number' (Search heavily in headers, boxed details, and corner reference text. Look near labels like "Certificate Number", "Certificate No", "Cert No", "Share Certificate Number", "Share Certificate No", "Serial Number", "Cert Ref", "ID Number", "Identification Number", or "ID No". If the document uses "ID Number" / "Identification Number" / "ID No" as the primary certificate identifier, return that EXACT value under 'certificate_number' and do NOT return it under a different key. Do NOT hallucinate. If not clearly present, return null.)
             2. 'shareholder_name' (name of person, company, or trust the shares are issued to)
             3. 'shareholder_type' (classify as "Individual", "Company", "Trust", or "Other")
             4. 'number_of_shares' (explicit total count of shares)
             5. 'share_class' (Search near labels like "Class", "Share Class", "Class of Shares", "Type of Shares" or values like "Ordinary", "Preference", "Common")
             6. 'ownership_percent' (percentage of ownership, e.g., '50%')
             Do not hallucinate. If the value is not visibly present on the document, return null.

           - For VAT Registrations, you must extract the 'vat_number'. This is typically a 10-digit number starting with 4. Look heavily near labels like "VAT Number", "VAT Registration Number", "VAT No", or "Value Added Tax Number". Return exactly the number as it appears.

           - For UIF Registrations, you must extract the 'uif_number'. Look heavily near labels like "UIF Reference Number", "UIF Reference", "UIF Number", "UIF No", "Fund Reference Number", or "Reference Number". Return exactly the number as it appears.

           - For PAYE Registrations, you must extract the 'paye_number'. Look heavily near labels like "PAYE Number", "PAYE Reference Number", "PAYE No", or "Employer Reference Number". Return exactly the number as it appears.

           - For Bank Confirmation Letters, do NOT only summarize validity.
  You must perform literal field extraction for:
  1. 'branch_code'
  2. 'account_number_last4'

  Search the FULL page carefully including:
  - headers
  - footers
  - account detail sections
  - banking tables
  - side panels
  - boxed account information
  - small-print sections

  These values may appear with labels such as:
  - "Branch Code"
  - "Branch code"
  - "Branch No"
  - "Branch Number"
  - "Account Number (Last 4)"
  - "Last 4 digits"
  - "Account last 4"
  - "Last four digits of account number"

  Extraction rules:
  
  [For Financial Documents]
  - branch_code: return the exact visible branch code as a string and preserve leading zeroes
  - account_number_last4: return only the exact final 4 digits of the visible account number
  
  [For OHS Plans]
  - plan_number: check for 'Plan Number', 'Plan No', 'Document Number', 'Document No', 'Doc No', 'Ref No', 'Reference Number', 'Plan ID'
  - safety_officer: check for 'Safety Officer', 'Safety Representative', 'OHS Representative', 'Responsible Person', 'Prepared By', 'Prepared by', 'Prepared For Safety'
  - revision_date: check for 'Date of Last Revision', 'Revision Date', 'Last Revision', 'Last Updated', 'Review Date', 'Version Date', 'Revision'
  
  [For SHE Files]
  - prepared_by: search headers, cover page blocks, author/preparer sections, footer/compiler sections, and signature/prepared-by boxes. Check for: 'Prepared By', 'Prepared by', 'Compiled By', 'Compiled by', 'Author', 'Responsible Person', 'Prepared For', 'Prepared For Safety', 'SHE Officer', 'Safety Officer (only if clearly acting as preparer/author)'
  - document_version: search top-right document info boxes, footer version blocks, revision/version tables, and cover page metadata boxes. Check for: 'Document Version', 'Version', 'Revision', 'Rev', 'Version Number', 'Doc Version', 'Document No / Version', 'Revision Number', 'Issue / Revision'
  - issue_date: check for 'Issue Date', 'Issued Date', 'Date Issued', 'Effective Date'

  [For SBD 6.1]
  - tender_number: check for 'Tender Number', 'Bid Number', 'RFQ Number'
  - bbbee_level: check for 'B-BBEE Level', 'BBBEE Status Level' 
  - claiming_points: check for 'Preference Points Claimed', 'Points Claimed'
  - representative_name: check for 'Authorized Signatory', 'Signatory', 'Name'
  - signature_date: check for 'Signature Date', 'Signed Date', 'Date'

  [General Rules]
  - if the values are present anywhere on the page, return them
  - only return null if they are truly absent
  - do NOT hallucinate or invent values

  [DEBUG INSTRUCTION]: 
  - If branch_code or account_number_last4 cannot be returned in structured JSON but appear visibly on the document, mention them explicitly inside 'reason' or 'summary' for debugging.
  - If prepared_by is null but a likely nearby text snippet exists, mention it briefly in 'reason'.
  - If document_version is null but a likely nearby text snippet exists, mention it briefly in 'reason'.

        4. **VALIDATE**: 
           - If a "required" field is missing or expired, mark as "valid": false.
           - "valid" should be boolean.

        RETURN JSON FORMAT ONLY:
        {
          "valid": boolean,
          "confidence": number, // 0-100
          "reason": "Short explanation of validity/mismatch judgment",
          "doc_type_detected": "What you think it is",
          "entity_name": "Exact Extracted Company Name/Entity" or null,
          "expiry_date": "YYYY-MM-DD" or null,
          "issue_date": "YYYY-MM-DD" or null,
          "registration_date": "YYYY-MM-DD" or null,
          "revision_date": "YYYY-MM-DD" or null,
          "document_version": "Document Version or Revision Number" or null,
          "reference_number": "Main extracted ID (e.g. PIN or Reg No)" or null,
          "pin": "SARS PIN if applicable" or null,
          "crs_number": "CIDB CRS Number if applicable" or null,
          "vat_number": "VAT Registration Number if applicable" or null,
          "uif_number": "UIF Reference Number if applicable" or null,
          "paye_number": "PAYE Registration Number if applicable" or null,
          "grade": "string or null",
          "class_of_work": "string or null",
          "bbbee_level": "B-BBEE Level (1-8) if applicable" or null,
          "black_ownership_percent": "Black Ownership % if applicable" or null,
          "issuing_body": "Name of issuer/verification agency if applicable" or null,
          "certificate_or_affidavit_number": "Certificate/Affidavit tracking number if applicable" or null,
          "maaa_number": "CSD MAAA Number if applicable" or null,
          "bank_name": "Bank Name if applicable" or null,
          "account_holder": "Bank Account Holder if applicable" or null,
          "account_number_last4": "Only the EXACT last 4 digits of the account number" or null,
          "branch_code": "Exact branch code string (preserve leading zeroes)" or null,
          "certificate_number": "Share Certificate Number if applicable" or null,
          "shareholder_name": "Name of shareholder if applicable" or null,
          "shareholder_type": "Individual/Company/Trust/Other" or null,
          "number_of_shares": "Count of shares if applicable (e.g. 100)" or null,
          "share_class": "Class of shares if applicable (e.g. Ordinary)" or null,
          "ownership_percent": "Ownership percentage if applicable" or null,
          "plan_number": "OHS Plan number or tracking ID" or null,
          "safety_officer": "Name of the safety officer or responsible agent" or null,
          "prepared_by": "Name of the author or compiler" or null,
          "tender_number": "Tender or Bid Number if applicable" or null,
          "claiming_points": "Preference points claimed if applicable" or null,
          "representative_name": "Name of the authorized signatory" or null,
          "signature_date": "YYYY-MM-DD" or null,
          "status": "E.g. Compliant, Active, or Non-Compliant based on context" or null,
          "summary": "Brief 2 sentence summary",
          "risks": ["Risk 1"],
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
