
import { useState, useEffect } from "react"
import { X, UploadCloud, FileText, Loader2, Save, Sparkles, AlertTriangle } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { DOCUMENT_TYPES } from "@/lib/taxonomy"
import { CompanyService } from "@/services/api"
import { toast } from "sonner"

// Helper functions integrated inline

interface DocumentUploadModalProps {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
    category: string
    docType: string
    title: string
    existingDoc?: boolean
    initialData?: any
    isManualEntry?: boolean
}

export default function DocumentUploadModal({ isOpen, onClose, onSuccess, category, docType, title, existingDoc = false, initialData, isManualEntry = false }: DocumentUploadModalProps) {
    const [uploading, setUploading] = useState(false)
    const [analyzing, setAnalyzing] = useState(false)
    const [metadata, setMetadata] = useState<any>({})
    const [fileToUpload, setFileToUpload] = useState<File | null>(null)
    const [aiFailed, setAiFailed] = useState(false)
    const [isHydrating, setIsHydrating] = useState(false)
    const warnings = metadata.warnings || []

    // Only used for rendering fields, not storage
    // @ts-ignore
    const def = DOCUMENT_TYPES[docType] || {}

    // Reset or Initialize when modal opens/closes
    useEffect(() => {
        if (!isOpen) {
            setFileToUpload(null)
            setMetadata({})
            setAnalyzing(false)
            setUploading(false)
            setAiFailed(false)
            setIsHydrating(false)
        } else if (initialData) {
            setIsHydrating(true)
            console.log("[EDIT MODE] Hydrating from initialData.id:", initialData.id)
            
            // 1. Defend against stringified JSON bugs
            let parsedMeta = initialData.metadata || {}
            if (typeof parsedMeta === 'string') {
                try {
                    parsedMeta = JSON.parse(parsedMeta)
                } catch (e) {
                    console.error("[EDIT MODE] Failed to parse stringified metadata", e)
                }
            }

            const baseMeta = { ...parsedMeta }
            
            // 2. Strip ISO timestamps for HTML5 date input compatibility
            if (initialData.issue_date) {
                baseMeta.issue_date = initialData.issue_date.includes('T') ? initialData.issue_date.split('T')[0] : initialData.issue_date
            }
            if (initialData.expiry_date) {
                baseMeta.expiry_date = initialData.expiry_date.includes('T') ? initialData.expiry_date.split('T')[0] : initialData.expiry_date
            }
            if (initialData.reference_number) baseMeta.reference_number = initialData.reference_number

            console.log("[EDIT MODE] Raw Metadata:", initialData.metadata)
            console.log("[EDIT MODE] Hydrated Form State:", baseMeta)
            
            // 3. Output PROOF logs to verify field key alignment
            const renderedKeys = def && 'fields' in def ? (def as any).fields.map((f: any) => f.key) : []
            console.log("[EDIT MODE] Rendered Field Keys:", renderedKeys)
            renderedKeys.forEach((key: string) => {
                console.log(`[EDIT MODE] field [${key}] value ->`, baseMeta[key])
            })
            
            setMetadata(baseMeta)
            setAnalyzing(false)
            setAiFailed(false)
            setIsHydrating(false)
        }
    }, [isOpen, initialData, docType])

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0]
            setFileToUpload(file)

            try {
                setAnalyzing(true)

                if (docType === 'shareholding') {
                    console.log(`[Shareholding Debug] analysis start - docType: ${docType}, file: ${file.name}`)
                }

                // 1. Upload to storage to get a path for analysis
                const userId = (await supabase.auth.getUser()).data.user?.id
                if (!userId) throw new Error("User not found")

                const fileName = `${userId}/${category}/${docType}/${Date.now()}_${file.name}`
                console.log("[FRONTEND PROOF] Uploading pre-analysis file to 'compliance' bucket at path:", fileName)
                const { error: uploadError } = await supabase.storage
                    .from('compliance')
                    .upload(fileName, file)

                if (uploadError) throw uploadError

                // 2. Analyze
                // Pass validation rules from taxonomy definition
                const rules = (DOCUMENT_TYPES as any)[docType] || {}
                const { data, error: analyzeError } = await CompanyService.analyzeDocument(fileName, docType, rules)

                // Detect explicit { error: "..." } or fallback payloads
                const hasErrorPayload = data && (data.error || data.details?.includes('Edge Function Error Catch') || (data.code === "GENERAL" && data.description?.includes("AI Analysis unavailable")))

                if (analyzeError || hasErrorPayload) {
                    console.warn("AI Analysis failed or unavailable:", analyzeError || data)
                    setAiFailed(true)
                } else if (data) {
                    setAiFailed(false)
                    // Safe mapping: The AI sometimes returns a wrapped object { valid, metadata } or just { fields }
                    const rawPayload = data.metadata || data.fields || data
                    console.log("[AI Raw Extraction]:", rawPayload)

                    if (docType === 'shareholding') {
                        console.log("[Shareholding Debug] raw ai response:", rawPayload)
                    }

                    const mappedData: any = {}
                    const normalizedAI: any = {}

                    // Normalize all AI keys for flexible matching
                    Object.entries(rawPayload).forEach(([k, v]) => {
                        normalizedAI[k.toLowerCase().replace(/[_\s-]/g, '')] = v
                    })

                    if (docType === 'shareholding') {
                        console.log("[Shareholding Debug] normalized metadata:", normalizedAI)
                    }

                    // Strict mapping: check exact key, flexible key, or flexible label
                    if (rules.fields) {
                        rules.fields.forEach((f: any) => {
                            const exactVal = rawPayload[f.key]
                            const flexKeyVal = normalizedAI[f.key.toLowerCase().replace(/[_\s-]/g, '')]
                            const flexLabelVal = normalizedAI[f.label.toLowerCase().replace(/[_\s-]/g, '')]

                            if (exactVal !== undefined) mappedData[f.key] = exactVal
                            else if (flexKeyVal !== undefined) mappedData[f.key] = flexKeyVal
                            else if (flexLabelVal !== undefined) mappedData[f.key] = flexLabelVal
                        })
                    }
                    // Fallback date extraction allowing taxonomy matches to persist, trimming ISO formatting for HTML5 type="date"
                    let rawExpiry = rawPayload.expiry_date || rawPayload.expiryDate || normalizedAI['expirydate'] || ""
                    let rawIssue = rawPayload.issue_date || rawPayload.issueDate || normalizedAI['issuedate'] || ""

                    if (rawExpiry && rawExpiry.includes('T')) rawExpiry = rawExpiry.split('T')[0]
                    if (rawIssue && rawIssue.includes('T')) rawIssue = rawIssue.split('T')[0]

                    mappedData.expiry_date = mappedData.expiry_date || rawExpiry
                    mappedData.issue_date = mappedData.issue_date || rawIssue

                    // Fallback entity_name extraction for robust mapping
                    if (!mappedData.entity_name) {
                        mappedData.entity_name = rawPayload.entity_name || rawPayload.entityName
                            || normalizedAI['entityname']
                            || normalizedAI['companyname']
                            || normalizedAI['legalentityname']
                            || normalizedAI['suppliername']
                            || ""
                    }

                    // VAT Certificate Normalization
                    if (docType === "vat_cert") {
                        if (!mappedData.vat_number) {
                            mappedData.vat_number = rawPayload.vat_number 
                                || rawPayload.vat_no
                                || rawPayload.vat_registration_number
                                || normalizedAI['vatnumber']
                                || normalizedAI['vatno']
                                || normalizedAI['vatregistrationnumber']
                                || normalizedAI['vatreference']
                                || normalizedAI['vatref']
                                || normalizedAI['valueaddedtaxnumber']
                                || mappedData.reference_number 
                                || rawPayload.reference_number 
                                || ""
                        }
                    }

                    // UIF Registration Normalization
                    if (docType === "uif_reg") {
                        if (!mappedData.uif_number) {
                            mappedData.uif_number = rawPayload.uif_number 
                                || rawPayload.uif_reference_number
                                || rawPayload.uif_reference
                                || rawPayload.uif_no
                                || rawPayload.fund_reference_number
                                || normalizedAI['uifnumber']
                                || normalizedAI['uifreferencenumber']
                                || normalizedAI['uifreference']
                                || normalizedAI['uifno']
                                || normalizedAI['fundreferencenumber']
                                || mappedData.reference_number 
                                || rawPayload.reference_number 
                                || ""
                        }
                    }

                    // PAYE Registration Normalization
                    if (docType === "paye_reg") {
                        if (!mappedData.paye_number) {
                            mappedData.paye_number = rawPayload.paye_number 
                                || rawPayload.paye_no
                                || rawPayload.paye_reference
                                || rawPayload.paye_reference_number
                                || rawPayload.employer_reference_number
                                || normalizedAI['payenumber']
                                || normalizedAI['payeno']
                                || normalizedAI['payereference']
                                || normalizedAI['payereferencenumber']
                                || normalizedAI['employerreferencenumber']
                                || mappedData.reference_number 
                                || rawPayload.reference_number 
                                || ""
                        }
                    }

                    // SARS_PIN Specific Normalization Layer
                    if (docType === "sars_pin") {
                        if (!mappedData.pin) {
                            mappedData.pin = rawPayload.pin || mappedData.reference_number || rawPayload.reference_number || ""
                        }
                        if (!mappedData.status && data.valid !== undefined) {
                            mappedData.status = data.valid ? "Compliant" : "Non-Compliant"
                        }
                        // Fallback entity name extraction from strongly quoted strings in summary if missing
                        if (!mappedData.entity_name && data.summary) {
                            // Target common South African company formatting heavily quoted by the AI
                            const quotedMatch = data.summary.match(/['"]((?:[^'"]+)?(?:Pty|Ltd|CC|Inc|Projects|Trading|Civil|Construction)(?:[^'"]+)?)['"]/i)
                            if (quotedMatch && quotedMatch[1]) {
                                mappedData.entity_name = quotedMatch[1]
                            }
                        }
                    }

                    // CIDB Certificate Custom Normalization
                    if (docType === "cidb_cert") {
                        if (!mappedData.crs_number) mappedData.crs_number = rawPayload.crs_number || rawPayload.crs || mappedData.reference_number || rawPayload.reference_number || ""

                        const cidbFields = (DOCUMENT_TYPES.cidb_cert as any).fields;
                        const VALID_GRADES: string[] = cidbFields.find((f: any) => f.key === "grade")?.options || [];
                        const VALID_CLASSES: string[] = cidbFields.find((f: any) => f.key === "class_of_work")?.options || [];

                        const logRawG = String(rawPayload.grade || rawPayload.cidb_grade || normalizedAI['grade'] || normalizedAI['cidbgrade'] || mappedData.grade || "");
                        const logRawC = String(rawPayload.class_of_work || rawPayload.class || rawPayload.cidb_class || normalizedAI['classofwork'] || normalizedAI['class'] || normalizedAI['cidbclass'] || mappedData.class_of_work || "");

                        let candG = logRawG.toUpperCase();
                        let candC = logRawC.toUpperCase();
                        let searchStr = "";

                        if (!VALID_GRADES.includes(candG) || !VALID_CLASSES.includes(candC)) {
                            searchStr = `${candG} ${candC} ${data.summary || rawPayload.summary || ""} ${data.reason || rawPayload.reason || ""} ${data.doc_type_detected || rawPayload.doc_type_detected || ""} ${mappedData.reference_number || rawPayload.reference_number || ""}`.toUpperCase();
                            const clsP = VALID_CLASSES.join('|');
                            
                            const combo = searchStr.match(new RegExp(`\\b([1-9])\\s*(${clsP})\\b`));
                            if (combo) {
                                if (!VALID_GRADES.includes(candG)) candG = combo[1]; 
                                if (!VALID_CLASSES.includes(candC)) candC = combo[2];
                            } else {
                                if (!VALID_GRADES.includes(candG)) {
                                    const eG = searchStr.match(/(?:GRADE|CIDB)\\s*([1-9])\\b/);
                                    if (eG) candG = eG[1];
                                }

                                if (!VALID_CLASSES.includes(candC)) {
                                    const cM = searchStr.match(new RegExp(`\\b(${clsP})\\b`));
                                    if (cM) candC = cM[1];
                                }
                            }
                        }

                        candG = String(candG).trim().replace(/[^0-9]/g, '');
                        candC = String(candC).trim().replace(/[^A-Z]/g, '');

                        mappedData.grade = VALID_GRADES.includes(candG) ? candG : "";
                        mappedData.class_of_work = VALID_CLASSES.includes(candC) ? candC : "";
                        mappedData._cidbSearchStr = searchStr;

                        if (!mappedData.status && data.valid !== undefined) mappedData.status = data.valid ? "Active" : "Suspended"
                    }

                    // B-BBEE Certificate Normalization
                    if (docType === "bbbee_cert") {
                        if (!mappedData.bbbee_level) {
                            mappedData.bbbee_level = rawPayload.bbbee_level || normalizedAI['bbbeelevel'] || normalizedAI['level'] || ""
                            if (typeof mappedData.bbbee_level === 'string' && mappedData.bbbee_level.toLowerCase().includes('non')) {
                                mappedData.bbbee_level = "Non-Compliant"
                            } else if (typeof mappedData.bbbee_level === 'string') {
                                const levelMatch = mappedData.bbbee_level.match(/\d/)
                                if (levelMatch) mappedData.bbbee_level = levelMatch[0]
                            }
                        }
                        if (!mappedData.black_ownership_percent) mappedData.black_ownership_percent = rawPayload.black_ownership_percent || normalizedAI['blackownership'] || ""
                        
                        let certNumFallback = ""
                        let issuerFallback = ""
                        const combinedText = String(data.summary || rawPayload.summary || "") + " " + String(data.reason || rawPayload.reason || "")
                        
                        const certMatch = combinedText.match(/(?:certificate number|affidavit number|ref number|reference|number is|cert no)[^\w]*([\w\-/]+)/i)
                        if (certMatch && certMatch[1] && certMatch[1].length > 3) certNumFallback = certMatch[1].trim()
                        
                        const issuerMatch = combinedText.match(/(?:issuing body|issuer|verification agency)[\s:]+([^.,\n]+)/i) 
                            || combinedText.match(/(?:issued by|verified by)\s+([A-Z][a-zA-Z0-9\s&]+?)(?=\.|\n|,| and | on |$)/i)
                        if (issuerMatch && issuerMatch[1]) issuerFallback = issuerMatch[1].trim()

                        if (!mappedData.certificate_or_affidavit_number) {
                            mappedData.certificate_or_affidavit_number = rawPayload.certificate_or_affidavit_number 
                                || rawPayload.certificate_number 
                                || rawPayload.affidavit_number 
                                || mappedData.reference_number 
                                || rawPayload.reference_number 
                                || normalizedAI['certificateoraffidavitnumber']
                                || normalizedAI['certificatenumber']
                                || normalizedAI['affidavitnumber']
                                || normalizedAI['referencenumber']
                                || certNumFallback
                        }

                        if (!mappedData.issuing_body) {
                            mappedData.issuing_body = rawPayload.issuing_body 
                                || rawPayload.issuer 
                                || rawPayload.issuing_agency 
                                || rawPayload.verification_agency 
                                || normalizedAI['issuingbody']
                                || normalizedAI['issuer']
                                || normalizedAI['issuingagency']
                                || normalizedAI['verificationagency']
                                || issuerFallback
                        }

                        console.log("=== PROOF LOGS FOR B-BBEE ONLY ===")
                        console.log("rawPayload:", JSON.stringify(rawPayload, null, 2))
                        console.log("rawPayload.issuing_body:", rawPayload.issuing_body)
                        console.log("rawPayload.issuer:", rawPayload.issuer)
                        console.log("rawPayload.issuing_agency:", rawPayload.issuing_agency)
                        console.log("rawPayload.verification_agency:", rawPayload.verification_agency)
                        console.log("rawPayload.certificate_or_affidavit_number:", rawPayload.certificate_or_affidavit_number)
                        console.log("rawPayload.certificate_number:", rawPayload.certificate_number)
                        console.log("rawPayload.affidavit_number:", rawPayload.affidavit_number)
                        console.log("rawPayload.reference_number:", rawPayload.reference_number)
                        console.log("rawPayload.summary:", data.summary || rawPayload.summary)
                        console.log("rawPayload.reason:", data.reason || rawPayload.reason)
                        console.log("final mappedData.issuing_body:", mappedData.issuing_body)
                        console.log("final mappedData.certificate_or_affidavit_number:", mappedData.certificate_or_affidavit_number)
                        console.log("==================================")
                    }

                    // CSD Normalization
                    if (docType === "csd_summary") {
                        if (!mappedData.maaa_number) mappedData.maaa_number = rawPayload.maaa_number || mappedData.reference_number || rawPayload.reference_number || ""
                        if (!mappedData.supplier_name) mappedData.supplier_name = mappedData.entity_name || ""
                        if (!mappedData.registration_status && data.valid !== undefined) mappedData.registration_status = data.valid ? "Active" : "Inactive"
                    }

                    // COID Normalization
                    if (docType === "coid_letter") {
                        if (!mappedData.coid_ref) mappedData.coid_ref = rawPayload.coid_ref || mappedData.reference_number || rawPayload.reference_number || ""
                        if (!mappedData.status && data.valid !== undefined) mappedData.status = data.valid ? "Valid" : "Invalid"
                    }

                    // CIPC Normalization
                    if (docType === "cipc_cert") {
                        if (!mappedData.registration_number) mappedData.registration_number = rawPayload.registration_number || mappedData.reference_number || rawPayload.reference_number || ""
                        if (!mappedData.registration_date) mappedData.registration_date = rawPayload.registration_date || mappedData.issue_date || rawPayload.issue_date || ""
                        if (!mappedData.entity_status && data.valid !== undefined) mappedData.entity_status = data.valid ? "In Business" : "Deregistered"
                    }

                    // Bank Letter Normalization
                    if (docType === "bank_letter") {
                        if (!mappedData.bank_name) mappedData.bank_name = rawPayload.bank_name || ""
                        if (!mappedData.account_holder) mappedData.account_holder = rawPayload.account_holder || mappedData.entity_name || ""
                        
                        let bankLast4Fallback = ""
                        let bankBranchFallback = ""
                        const combinedBankText = String(data.summary || rawPayload.summary || "") + " " + String(data.reason || rawPayload.reason || "")
                        
                        const accMatch = combinedBankText.match(/(?:last 4|last four|last 4 digits|account last 4|account number \(last 4\))[\D]*(\d{4})\b/i)
                        if (accMatch && accMatch[1]) bankLast4Fallback = accMatch[1]
                        
                        const branchMatch = combinedBankText.match(/branch code[\s:]*(\d+)/i)
                        if (branchMatch && branchMatch[1]) bankBranchFallback = branchMatch[1]

                        if (!mappedData.account_number_last4) {
                            const rawAcc = String(rawPayload.account_number_last4 
                                || rawPayload.accountlast4 
                                || rawPayload.last4 
                                || rawPayload.account_number 
                                || normalizedAI['accountnumberlast4']
                                || normalizedAI['accountlast4']
                                || normalizedAI['last4']
                                || normalizedAI['accountnumber']
                                || mappedData.reference_number 
                                || rawPayload.reference_number 
                                || bankLast4Fallback
                                || "").replace(/\D/g, '')

                            if (rawAcc && rawAcc.length >= 4) {
                                mappedData.account_number_last4 = rawAcc.slice(-4)
                            } else if (rawAcc) {
                                mappedData.account_number_last4 = rawAcc // Fallback
                            }
                        }
                        
                        if (!mappedData.branch_code) {
                            mappedData.branch_code = String(rawPayload.branch_code 
                                || rawPayload.branchcode 
                                || rawPayload.bank_branch_code 
                                || rawPayload.code 
                                || normalizedAI['branchcode']
                                || normalizedAI['bankbranchcode']
                                || normalizedAI['code']
                                || bankBranchFallback
                                || "").trim()
                        }

                        console.log("=== PROOF LOGS FOR BANK LETTER ONLY ===")
                        console.log("rawPayload:", JSON.stringify(rawPayload, null, 2))
                        console.log("rawPayload.branch_code:", rawPayload.branch_code)
                        console.log("rawPayload.branchcode:", rawPayload.branchcode)
                        console.log("rawPayload.bank_branch_code:", rawPayload.bank_branch_code)
                        console.log("rawPayload.code:", rawPayload.code)
                        console.log("rawPayload.account_number_last4:", rawPayload.account_number_last4)
                        console.log("rawPayload.accountlast4:", rawPayload.accountlast4)
                        console.log("rawPayload.last4:", rawPayload.last4)
                        console.log("rawPayload.account_number:", rawPayload.account_number)
                        console.log("rawPayload.reference_number:", rawPayload.reference_number)
                        console.log("rawPayload.summary:", data.summary || rawPayload.summary)
                        console.log("rawPayload.reason:", data.reason || rawPayload.reason)
                        console.log("final mappedData.branch_code:", mappedData.branch_code)
                        console.log("final mappedData.account_number_last4:", mappedData.account_number_last4)
                        console.log("=======================================")
                    }

                    // Shareholding Normalization
                    if (docType === "shareholding") {
                        console.log("[Shareholding Debug] certificate candidates:", {
                            "raw.certificate_number": rawPayload.certificate_number, "raw.cert_number": rawPayload.cert_number, "raw.certificate_no": rawPayload.certificate_no,
                            "norm.certificatenumber": normalizedAI['certificatenumber'], "norm.certificateno": normalizedAI['certificateno'], "norm.certno": normalizedAI['certno']
                        })
                        console.log("[Shareholding Debug] shareholder_type candidates:", {
                            "raw.shareholder_type": rawPayload.shareholder_type, "raw.shareholder_category": rawPayload.shareholder_category, "raw.type": rawPayload.type,
                            "norm.shareholdertype": normalizedAI['shareholdertype'], "norm.shareholdercategory": normalizedAI['shareholdercategory']
                        })
                        console.log("[Shareholding Debug] shares candidates:", {
                            "raw.number_of_shares": rawPayload.number_of_shares, "raw.shares": rawPayload.shares, "raw.total_shares": rawPayload.total_shares,
                            "norm.numberofshares": normalizedAI['numberofshares'], "norm.shares": normalizedAI['shares']
                        })
                        console.log("[Shareholding Debug] share_class candidates:", {
                            "raw.share_class": rawPayload.share_class, "raw.class": rawPayload.class, "raw.class_of_shares": rawPayload.class_of_shares,
                            "norm.shareclass": normalizedAI['shareclass'], "norm.class": normalizedAI['class']
                        })
                        console.log("[Shareholding Debug] ownership candidates:", {
                            "raw.ownership_percent": rawPayload.ownership_percent, "raw.ownership_percentage": rawPayload.ownership_percentage, "raw.percentage": rawPayload.percentage,
                            "norm.ownershippercent": normalizedAI['ownershippercent'], "norm.ownershippercentage": normalizedAI['ownershippercentage'], "norm.percentage": normalizedAI['percentage']
                        })

                        if (!mappedData.certificate_number) {
                            mappedData.certificate_number = rawPayload.certificate_number || rawPayload.cert_number || rawPayload.certificate_no || rawPayload.id_number || rawPayload.id || rawPayload.identification_number || normalizedAI['certificatenumber'] || normalizedAI['certificateno'] || normalizedAI['certno'] || normalizedAI['idnumber'] || normalizedAI['identificationnumber'] || mappedData.reference_number || rawPayload.reference_number || ""
                        }
                        if (!mappedData.shareholder_name) {
                            mappedData.shareholder_name = rawPayload.shareholder_name || rawPayload.shareholder || rawPayload.name || normalizedAI['shareholdername'] || normalizedAI['shareholder'] || mappedData.entity_name || ""
                        }
                        if (!mappedData.shareholder_type) {
                            mappedData.shareholder_type = rawPayload.shareholder_type || rawPayload.shareholder_category || rawPayload.type || normalizedAI['shareholdertype'] || normalizedAI['shareholdercategory'] || ""
                            if (mappedData.shareholder_type) {
                                const st = String(mappedData.shareholder_type).toLowerCase()
                                if (st.includes("indiv") || st.includes("person") || st.includes("human")) mappedData.shareholder_type = "Individual"
                                else if (st.includes("comp") || st.includes("pty") || st.includes("ltd") || st.includes("cc") || st.includes("inc")) mappedData.shareholder_type = "Company"
                                else if (st.includes("trust")) mappedData.shareholder_type = "Trust"
                                else if (st !== "Individual" && st !== "Company" && st !== "Trust") mappedData.shareholder_type = "Other"
                            }
                        }
                        if (!mappedData.number_of_shares) {
                            mappedData.number_of_shares = rawPayload.number_of_shares || rawPayload.shares || rawPayload.total_shares || normalizedAI['numberofshares'] || normalizedAI['shares'] || ""
                        }
                        if (!mappedData.share_class) {
                            mappedData.share_class = rawPayload.share_class || rawPayload.class || rawPayload.class_of_shares || normalizedAI['shareclass'] || normalizedAI['class'] || ""
                        }
                        if (!mappedData.ownership_percent) {
                            mappedData.ownership_percent = rawPayload.ownership_percent || rawPayload.ownership_percentage || rawPayload.percentage || normalizedAI['ownershippercent'] || normalizedAI['ownershippercentage'] || normalizedAI['percentage'] || ""
                        }
                    }

                    console.log("=== PROOF LOGS FOR CIDB ONLY ===")
                    if (docType === "cidb_cert") {
                        const cidbF = (DOCUMENT_TYPES.cidb_cert as any).fields;
                        console.log("rawPayload.grade:", rawPayload.grade);
                        console.log("rawPayload.class_of_work:", rawPayload.class_of_work);
                        console.log("rawPayload.class:", rawPayload.class);
                        console.log("rawPayload.summary:", data.summary || rawPayload.summary);
                        console.log("rawPayload.reason:", data.reason || rawPayload.reason);
                        console.log("final search string used:", mappedData._cidbSearchStr);
                        console.log("final mappedData.grade:", mappedData.grade);
                        console.log("final mappedData.class_of_work:", mappedData.class_of_work);
                        console.log("exact allowed grade options:", cidbF.find((f:any)=>f.key==="grade")?.options);
                        console.log("exact allowed class options:", cidbF.find((f:any)=>f.key==="class_of_work")?.options);
                        delete mappedData._cidbSearchStr;
                    }
                    console.log("================================")

                    console.log("[DEBUG 1] AI Raw Payload:", rawPayload)
                    console.log("[DEBUG 2] Normalized AI:", normalizedAI)
                    console.log("[DEBUG 3] Mapped Fields:", mappedData)

                    if (docType === "cidb_cert") {
                        console.log("=== FINAL SELECT DEBUG ===");
                        console.log("grade value:", mappedData.grade, typeof mappedData.grade);
                        console.log("class value:", mappedData.class_of_work, typeof mappedData.class_of_work);

                        const cidbF = (DOCUMENT_TYPES.cidb_cert as any).fields;
                        console.log("grade options:", cidbF.find((f:any)=>f.key==="grade")?.options);
                        console.log("class options:", cidbF.find((f:any)=>f.key==="class_of_work")?.options);
                        console.log("==========================");
                    }

                    if (docType === 'shareholding') {
                        console.log("[Shareholding Debug] final hydrated metadata:", mappedData)
                    }

                    setMetadata(mappedData)
                    // Validation blockers removed to allow unhindered partial save.
                }

            } catch (err) {
                console.error("Analysis process failed", err)
            } finally {
                setAnalyzing(false)
            }
        }
    }

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!fileToUpload && !initialData && !isManualEntry) return

        setUploading(true)
        try {
            // Pre-save normalization (canonical formatting)
            const finalMetadata = { ...metadata }

            // Percentage normalization (ensure ends with %)
            if (finalMetadata.black_ownership_percent) {
                let val = finalMetadata.black_ownership_percent.replace(/\s+/g, '')
                if (!val.endsWith('%')) val += '%'
                finalMetadata.black_ownership_percent = val
            }

            // Fallback upper-casing for MAAA
            if (finalMetadata.maaa_number) {
                finalMetadata.maaa_number = finalMetadata.maaa_number.toUpperCase()
            }

            // Compute Incomplete State based on strict taxonomy
            const def = (DOCUMENT_TYPES as any)[docType] || {}
            const isComplete = !('fields' in def) || def.fields.filter((f: any) => f.required).every((f: any) => !!finalMetadata[f.key])
            finalMetadata.is_incomplete = !isComplete

            if (initialData?.id && !fileToUpload) {
                const { error } = await CompanyService.updateComplianceDoc(initialData.id, finalMetadata)
                if (error) throw new Error(error)
            } else {
                if (!fileToUpload && !isManualEntry) throw new Error("File required")
                const { error } = await CompanyService.uploadComplianceDoc(fileToUpload, category, docType, finalMetadata)
                if (error) throw new Error(error)
            }

            if (finalMetadata.is_incomplete) {
                toast.success("Document saved as incomplete. You can finish it later.")
            } else {
                toast.success("Your compliance document was uploaded successfully.")
            }

            onSuccess()
            onClose()
        } catch (error) {
            console.error(error)
            toast.error("Upload Failed", { 
                description: "We couldn’t save this document right now. Your file details are still here, so you can retry." 
            })
        } finally {
            setUploading(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center shrink-0">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900">Document Details</h3>
                        <p className="text-sm text-gray-500 mt-1">Please provide details for <strong>{title}</strong></p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="overflow-y-auto p-6">
                    {/* REPLACEMENT WARNING */}
                    {existingDoc && !fileToUpload && !initialData && (
                        <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-lg flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
                            <div>
                                <h4 className="text-sm font-bold text-orange-900">Replace Existing Document?</h4>
                                <p className="text-sm text-orange-800 mt-1">
                                    You are about to replace an existing <strong>{title}</strong>. The old file will be permanently overwritten.
                                </p>
                            </div>
                        </div>
                    )}

                    {!fileToUpload && !initialData && !isManualEntry ? (
                        <div className="text-center">
                            <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 hover:border-primary transition-colors cursor-pointer relative">
                                <input
                                    type="file"
                                    accept="application/pdf,image/*"
                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                    onChange={handleFileSelect}
                                />
                                <UploadCloud className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                                <p className="text-sm font-medium text-gray-900">Click to upload or drag and drop</p>
                                <p className="text-xs text-gray-500 mt-1">PDF or Image up to 10MB</p>
                                <p className="text-[10px] text-gray-400 mt-3 absolute bottom-2 w-full text-center left-0">For testing, structured internal QA documents are accepted.</p>
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={handleSave} className="space-y-4" noValidate>
                            {/* File Preview */}
                            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-700">
                                <FileText className="w-5 h-5 text-gray-400" />
                                <span className="truncate flex-1">{fileToUpload?.name || initialData?.file_name || "Manual Entry Metadata"}</span>
                                {analyzing ? (
                                    <div className="flex items-center text-primary text-xs font-medium">
                                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                        Scanning...
                                    </div>
                                ) : aiFailed ? (
                                    <div className="flex items-center text-orange-600 text-xs font-medium">
                                        <AlertTriangle className="w-4 h-4 mr-1" />
                                        Manual Entry
                                    </div>
                                ) : (
                                    <div className="flex items-center text-green-600 text-xs font-medium">
                                        <Sparkles className="w-4 h-4 mr-1" />
                                        AI Analyzed
                                    </div>
                                )}
                            </div>

                            {/* AI Failure Block */}
                            {aiFailed && (
                                <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg flex items-start gap-3">
                                    <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5 shrink-0" />
                                    <div>
                                        <h4 className="text-sm font-bold text-orange-900">AI Analysis Failed</h4>
                                        <p className="text-sm text-orange-800 mt-1">
                                            We couldn't automatically extract information from this document. Please review and enter the details manually.
                                        </p>
                                        <p className="text-xs text-orange-700 mt-2 opacity-80">
                                            This can happen due to network issues or unrecognizable formatting.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Partial Analysis Block */}
                            {!analyzing && !isHydrating && !aiFailed && fileToUpload && 'fields' in def && (
                                (() => {
                                    const taxonomyFields = (def as any).fields.map((f: any) => f.key)
                                    const filledCount = taxonomyFields.filter((k: string) => !!metadata[k]).length
                                    if (filledCount > 0 && filledCount < taxonomyFields.length) {
                                        return (
                                            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2">
                                                <Sparkles className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                                                <div>
                                                    <h4 className="text-sm font-bold text-blue-900">Partial Analysis</h4>
                                                    <p className="text-xs text-blue-800 mt-0.5">AI extracted some details, but a few fields still need manual review.</p>
                                                </div>
                                            </div>
                                        )
                                    }
                                    return null
                                })()
                            )}


                            {/* Validation Warnings */}
                            {warnings.length > 0 && (
                                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                                    <div className="flex items-start gap-2">
                                        <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5 shrink-0" />
                                        <div className="space-y-1">
                                            {warnings.map((w: any, idx: number) => (
                                                <p key={idx} className="text-xs text-yellow-800 font-medium">{w} (You can still save)</p>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Critical validation blockers removed to support partial saves */}

                            {/* Dynamic Fields from Taxonomy */}
                            {'fields' in def && (def as any).fields?.map((field: any) => (
                                <div key={field.key}>
                                    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                                        {field.label}
                                        {field.required ? (
                                            <span className="text-red-500">*</span>
                                        ) : (
                                            <span className="text-[10px] text-gray-400 font-normal uppercase tracking-wider bg-gray-100 px-1.5 py-0.5 rounded">Optional</span>
                                        )}
                                    </label>

                                    {field.type === 'select' ? (
                                        <select
                                            className={`w-full px-3 py-2 border rounded-lg text-sm bg-white focus:ring-primary focus:border-primary ${field.required && !metadata[field.key] ? 'border-orange-300' : 'border-gray-300'}`}
                                            value={metadata[field.key] || ""}
                                            onChange={(e) => setMetadata({ ...metadata, [field.key]: e.target.value })}
                                        >
                                            <option value="">Select...</option>
                                            {field.options?.map((opt: string) => (
                                                <option key={opt} value={opt}>{opt}</option>
                                            ))}
                                        </select>
                                    ) : field.type === 'info' ? (
                                        <p className="text-sm text-red-600 font-medium">{field.label}</p>
                                    ) : (
                                        <>
                                            <input
                                                type={field.type || "text"}
                                                placeholder={field.placeholder}
                                                pattern={field.validationRegex}
                                                title={field.validationMessage}
                                                className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-primary focus:border-primary ${field.key === 'expiry_date' && metadata.expiry_date && new Date().getTime() > new Date(metadata.expiry_date).getTime() ? 'border-red-300 bg-red-50 text-red-900' : ''}`}
                                                value={metadata[field.key] || ""}
                                                onChange={(e) => {
                                                    let val = e.target.value
                                                    // Real-time normalization for strict alphanumeric fields
                                                    if (['pin', 'crs_number', 'maaa_number', 'vat_number', 'uif_number', 'registration_number'].includes(field.key)) {
                                                        val = val.replace(/[\s-]/g, '')
                                                        if (field.key === 'maaa_number') val = val.toUpperCase()
                                                    }
                                                    // Date validated at render level, no longer blocking save
                                                    setMetadata((prev: any) => ({ ...prev, [field.key]: val }))
                                                }}
                                            />
                                            {field.key === 'expiry_date' && metadata.expiry_date && new Date().getTime() > new Date(metadata.expiry_date).getTime() && (
                                                <p className="text-xs text-red-600 mt-1 font-medium">Warning: This date is in the past.</p>
                                            )}
                                        </>
                                    )}
                                </div>
                            ))}

                            <div className="pt-4 flex justify-end gap-3 border-t border-gray-100 mt-6 md:sticky md:bottom-0 bg-white">
                                <button
                                    type="button"
                                    onClick={() => { setFileToUpload(null); setMetadata({}); }}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                                >
                                    Replace File
                                </button>
                                <button
                                    type="submit"
                                    disabled={uploading || analyzing}
                                    className="flex items-center px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                                    Confirm & Save
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div >
        </div >
    )
}
