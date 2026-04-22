import { useState, useRef, useEffect } from "react"
import { Upload, X, FileText, Loader2, CheckCircle2, AlertTriangle, ArrowLeft } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { TenderService } from "@/services/api"
import * as Sentry from "@sentry/react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
// import { cn } from "@/lib/utils"

const debugLog = (...args: any[]) => {
    if (!import.meta.env.PROD || import.meta.env.VITE_ENABLE_TENDER_DEBUG === "true") {
        console.log(...args);
    }
};

const generateTraceId = () => {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

const DOC_KEYWORDS = {
    cipc_cert: ['cipc', 'company registration', 'cor14.3', 'ck1'],
    cidb_proof: ['cidb'],
    sars_pin: ['sars', 'tax pin', 'tax clearance', 'tcs pin'],
    csd_summary: ['csd', 'central supplier', 'maaa'],
    coid_letter: ['coid', 'good standing', 'wca', 'letter of good standing'],
    bbbee_cert: ['b-bbee', 'bbbee', 'bbee', 'sworn affidavit'],
    vat_reg: ['vat reg', 'value added tax'],
    uif_letter: ['uif'],
    paye_reg: ['paye'],
    bank_letter: ['bank letter', 'bank confirmation', 'cancelled cheque'],
    sbd_6_1: ['sbd 6.1', 'sbd6.1'],
    ohs_plan: ['ohs plan', 'health and safety plan', 'health & safety plan'],
    she_file: ['she file', 'safety file']
};

// Tender AI Edge Function output shape
interface RawTenderAiPayload {
    title?: string;
    tender_title?: string;
    description?: string;
    tender_description?: string;
    summary?: string;
    client_name?: string;
    entity_name?: string;
    tender_number?: string;
    reference_number?: string;
    closing_date?: string;
    expiry_date?: string;
    signature_date?: string;
    cidb_grade?: string;
    grade?: string;
    cidb_class?: string;
    class_of_work?: string;
    min_bbbee_level?: string;
    bbbee_level?: string;
    preference_points?: string;
    claiming_points?: string;
    pref_points?: string;
    requirements?: unknown;
    compliance_requirements?: unknown;
    mandatory_returnables?: unknown;
    required_documents?: unknown;
    returnables?: unknown;
    documents?: unknown;
    [key: string]: unknown;
}

// Extracted AI Qualification data
interface ExtractedQualifications {
    grade: string;
    class: string;
    bbbee: string;
    prefPoints: string;
    compulsoryBriefing: boolean | null;
}

// Mandatory documents explicitly required by this specific tender (e.g. CSD, SARS pin)
// Note: This maps to the Tender's required returnables, which are later evaluated against the user's uploaded compliance documents.
type MandatoryDocKeys = keyof typeof DOC_KEYWORDS;
type MandatoryDocsState = Record<MandatoryDocKeys, boolean>;

const mandatoryDocsSchema = z.object({
    cipc_cert: z.boolean().default(false),
    cidb_proof: z.boolean().default(false),
    sars_pin: z.boolean().default(false),
    csd_summary: z.boolean().default(false),
    coid_letter: z.boolean().default(false),
    bbbee_cert: z.boolean().default(false),
    vat_reg: z.boolean().default(false),
    uif_letter: z.boolean().default(false),
    paye_reg: z.boolean().default(false),
    bank_letter: z.boolean().default(false),
    sbd_6_1: z.boolean().default(false),
    ohs_plan: z.boolean().default(false),
    she_file: z.boolean().default(false)
});

const manualFormSchema = z.object({
    title: z.string().min(3, "Tender Name must be at least 3 characters."),
    client: z.string().min(3, "Client Name must be at least 3 characters."),
    tenderNumber: z.string().optional().default(""),
    tenderDescription: z.string().optional().default(""),
    closingDate: z.string().min(1, "Closing Date is required.").refine((val) => {
        if (!val) return false;
        const closing = new Date(val);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return closing >= today;
    }, { message: "Closing Date cannot be in the past." }),
    grade: z.string().optional().default(""),
    class: z.string().optional().default(""),
    bbbee: z.string().optional().default(""),
    prefPoints: z.string().optional().default(""),
    compulsoryBriefing: z.boolean().optional().default(false),
    additionalReturnables: z.string().optional().default(""),
    notes: z.string().optional().default(""),
    mandatoryDocs: mandatoryDocsSchema
});

export type ManualFormState = z.infer<typeof manualFormSchema>;

const normalizeTenderMandatoryDocs = (data: RawTenderAiPayload, prevDocs: MandatoryDocsState): MandatoryDocsState => {
    const mandatoryDocs = { ...prevDocs };
    
    // Safely type requirements without broad Record<string, any>
    const reqs = (typeof data.requirements === 'object' && data.requirements !== null)
        ? data.requirements as { mandatory_docs_normalized?: unknown; mandatory_docs_raw?: unknown }
        : {};
    
    const primaryNormalized = reqs.mandatory_docs_normalized;
    const primaryRaw = reqs.mandatory_docs_raw;
    
    let usedSource = "none";
    let foundPrimary = false;

    if (Array.isArray(primaryNormalized) && primaryNormalized.length > 0) {
        usedSource = "requirements.mandatory_docs_normalized";
        foundPrimary = true;
        primaryNormalized.forEach(item => {
            const key = safeToString(item).toLowerCase();
            if (key in mandatoryDocs) {
                mandatoryDocs[key as keyof typeof mandatoryDocs] = true;
            } else {
                Object.entries(DOC_KEYWORDS).forEach(([docKey, keywords]) => {
                    if (keywords.some(k => key.includes(k.toLowerCase()))) {
                        mandatoryDocs[docKey as keyof typeof mandatoryDocs] = true;
                    }
                });
            }
        });
    }

    let textToSearch = "";

    if (primaryRaw) {
        if (usedSource === "none") usedSource = "requirements.mandatory_docs_raw";
        else usedSource += " + requirements.mandatory_docs_raw";
        foundPrimary = true;
        
        if (Array.isArray(primaryRaw)) {
            textToSearch = primaryRaw.map(safeToString).join(' ');
        } else {
            textToSearch = safeToString(primaryRaw);
        }
    }

    if (!foundPrimary) {
        const legacyFallbacks = [
            data.mandatory_returnables,
            data.required_documents,
            data.documents,
            data.returnables
        ].filter(Boolean);

        if (legacyFallbacks.length > 0) {
            usedSource = "legacy_fallbacks";
            textToSearch = legacyFallbacks.map(fallback => {
                if (Array.isArray(fallback)) {
                    return fallback.map(safeToString).join(' ');
                }
                return safeToString(fallback);
            }).join(' ');
        }
    }

    if (textToSearch) {
        const flatStr = textToSearch.toLowerCase();
        Object.entries(DOC_KEYWORDS).forEach(([key, keywords]) => {
            if (keywords.some(k => flatStr.includes(k.toLowerCase()))) {
                mandatoryDocs[key as keyof typeof mandatoryDocs] = true;
            }
        });
    }

    debugLog(`[Tender Debug] Mandatory docs source:`, usedSource);
    debugLog(`[Tender Debug] Mandatory docs checkbox mapping:`, mandatoryDocs);

    return mandatoryDocs;
};

const VALID_CIDB_CLASSES = ["CE", "GB", "ME", "EP", "EB", "SO", "SQ", "SH", "SI", "SJ", "SK", "SL"];
const CLASSES_REGEX = VALID_CIDB_CLASSES.join("|");

const safeToString = (val: unknown): string => {
    if (typeof val === "string") return val;
    if (typeof val === "number" || typeof val === "boolean") return String(val);
    try {
        return JSON.stringify(val);
    } catch {
        return "";
    }
};

const gatherText = (obj: RawTenderAiPayload, keys: string[]): string => {
    if (!obj || typeof obj !== 'object') return "";
    return keys.map(k => {
        const val = obj[k];
        if (!val) return "";
        return safeToString(val);
    }).join(' ');
};

interface StructuredCandidate {
    grade?: string;
    class?: string;
    bbbee?: string;
    prefPoints?: string;
    compulsoryBriefing?: boolean;
}

const extractStructuredCandidate = (data: RawTenderAiPayload): StructuredCandidate => {
    const candidate: StructuredCandidate = {};
    const sources = [data.requirements, data.compliance_requirements];
    
    for (const src of sources) {
        if (!src || typeof src !== 'object') continue;
        const obj = src as Record<string, unknown>;
        
        const grade = obj.cidb_grade ?? obj.grade;
        if (grade && (typeof grade === 'string' || typeof grade === 'number') && !candidate.grade) {
            candidate.grade = String(grade);
        }
        
        const cls = obj.cidb_class ?? obj.class_of_work;
        if (cls && (typeof cls === 'string' || typeof cls === 'number') && !candidate.class) {
            candidate.class = String(cls);
        }
        
        const bbbee = obj.min_bbbee_level ?? obj.bbbee_level;
        if (bbbee && (typeof bbbee === 'string' || typeof bbbee === 'number') && !candidate.bbbee) {
            candidate.bbbee = String(bbbee);
        }
        
        const pref = obj.preference_points ?? obj.pref_points;
        if (pref && (typeof pref === 'string' || typeof pref === 'number') && !candidate.prefPoints) {
            candidate.prefPoints = String(pref);
        }
        
        const brief = obj.compulsory_briefing ?? obj.briefing_session;
        if (typeof brief === 'boolean' && candidate.compulsoryBriefing === undefined) {
            candidate.compulsoryBriefing = brief;
        } else if (typeof brief === 'string' && candidate.compulsoryBriefing === undefined) {
            if (/true|yes|compulsory|mandatory/i.test(brief)) candidate.compulsoryBriefing = true;
            if (/false|no|not/i.test(brief)) candidate.compulsoryBriefing = false;
        }
    }
    
    if (Object.keys(candidate).length > 0) {
        debugLog(`[Tender Debug] Structured requirement candidate:`, candidate);
    }
    
    return candidate;
};

const normalizePreferencePoints = (data: RawTenderAiPayload, candidate: StructuredCandidate): string => {
    const explicit = gatherText(data, ['preference_points', 'claiming_points', 'pref_points']);
    const nestedExplicit = candidate.prefPoints || "";
    const reqs = gatherText(data, ['requirements', 'compliance_requirements']);
    const summary = gatherText(data, ['summary', 'description']);
    const full = safeToString(data);

    const findPoints = (str: string, requireKeywords: boolean) => {
        if (!str) return "";
        const cleanStr = str.replace(/[\s\-]/g, '');
        if (!requireKeywords) {
            if (cleanStr.includes("80/20") || cleanStr.includes("8020")) return "80/20";
            if (cleanStr.includes("90/10") || cleanStr.includes("9010")) return "90/10";
        } else {
            if (/preference[ -]?point(?:s|system)(?:for)?.*?80(?:[\/s\-]?)20/i.test(cleanStr)) return "80/20";
            if (/preference[ -]?point(?:s|system)(?:for)?.*?90(?:[\/s\-]?)10/i.test(cleanStr)) return "90/10";
        }
        return "";
    };

    return findPoints(explicit, false) || findPoints(nestedExplicit, false) || findPoints(reqs, false) || findPoints(summary, true) || findPoints(full, true);
};

const normalizeCidbGrade = (data: RawTenderAiPayload, candidate: StructuredCandidate): string => {
    const explicit = gatherText(data, ['cidb_grade', 'grade']);
    const nestedExplicit = candidate.grade || "";
    const reqs = gatherText(data, ['requirements', 'compliance_requirements']);
    const summary = gatherText(data, ['summary', 'description']);
    const full = safeToString(data);

    const findGrade = (str: string, isStructured: boolean) => {
        if (!str) return "";
        let match;
        if (isStructured) {
            match = str.match(new RegExp(`(?:grade|cidb)?\\s*([1-9])\\s*(?:${CLASSES_REGEX})?`, "i"));
        } else {
            match = str.match(new RegExp(`(?:cidb|grading\\s*designation|grade\\s*required)\\s*(?:grade\\s*)?([1-9])\\s*(?:${CLASSES_REGEX})?`, "i"));
        }
        return match ? match[1] : "";
    };

    return findGrade(explicit, true) || findGrade(nestedExplicit, true) || findGrade(reqs, false) || findGrade(summary, false) || findGrade(full, false);
};

const normalizeCidbClass = (data: RawTenderAiPayload, candidate: StructuredCandidate): string => {
    const explicit = gatherText(data, ['cidb_class', 'class_of_work', 'cidb_grade', 'grade']);
    const nestedExplicit = candidate.class || candidate.grade || "";
    const reqs = gatherText(data, ['requirements', 'compliance_requirements']);
    const summary = gatherText(data, ['summary', 'description']);
    const full = safeToString(data);

    const findClass = (str: string, isStructured: boolean) => {
        if (!str) return "";
        const upperStr = str.toUpperCase();
        let match;
        if (isStructured) {
            const found = VALID_CIDB_CLASSES.find(c => upperStr.includes(c));
            if (found) return found;
            match = upperStr.match(new RegExp(`[1-9]\\s*(${CLASSES_REGEX})`));
        } else {
            match = upperStr.match(new RegExp(`(?:CIDB|GRADING).{0,20}[1-9]\\s*(${CLASSES_REGEX})`, 'i'));
        }
        return match ? match[1] : "";
    };

    return findClass(explicit, true) || findClass(nestedExplicit, true) || findClass(reqs, false) || findClass(summary, false) || findClass(full, false);
};

const normalizeBbbeeLevel = (data: RawTenderAiPayload, candidate: StructuredCandidate): string => {
    const explicit = gatherText(data, ['min_bbbee_level', 'bbbee_level', 'bbee_level']);
    const nestedExplicit = candidate.bbbee || "";
    const reqs = gatherText(data, ['requirements', 'compliance_requirements']);
    const summary = gatherText(data, ['summary', 'description']);
    const full = safeToString(data);

    const findBbbee = (str: string, isStructured: boolean) => {
        if (!str) return "";
        let match;
        if (isStructured) {
            match = str.match(/(?:level|b-?bbee).{0,10}([1-8])/i);
        } else {
            match = str.match(/minimum\s*(?:b-?bbee\s*)?(?:status\s*)?level\s*(?:of\s*)?([1-8])/i);
        }
        return match ? match[1] : "";
    };

    return findBbbee(explicit, true) || findBbbee(nestedExplicit, true) || findBbbee(reqs, false) || findBbbee(summary, false) || findBbbee(full, false);
};

const normalizeCompulsoryBriefing = (data: RawTenderAiPayload, candidate: StructuredCandidate): boolean | null => {
    if (candidate.compulsoryBriefing !== undefined) return candidate.compulsoryBriefing;

    const texts = [
        gatherText(data, ['compulsory_briefing', 'briefing_session']),
        gatherText(data, ['requirements', 'compliance_requirements']),
        gatherText(data, ['summary', 'description']),
        safeToString(data)
    ];

    for (const str of texts) {
        if (!str) continue;
        if (/(compulsory|mandatory)\s+(site\s+)?(briefing|meeting|inspection)/i.test(str) || 
            /(briefing|meeting|inspection)\s+(is\s+)?(compulsory|mandatory)/i.test(str)) {
            return true;
        }
    }
    return null;
};

const normalizeTenderAiData = (data: RawTenderAiPayload, prev: ManualFormState, traceId: string): ManualFormState => {
    const extractDate = (val: any) => val ? String(val).split('T')[0] : null;

    // Pure extracted AI object before any form fallbacks clutter the telemetry
    const candidate = extractStructuredCandidate(data);
    const extractedAI: ExtractedQualifications = {
        grade: normalizeCidbGrade(data, candidate),
        class: normalizeCidbClass(data, candidate),
        bbbee: normalizeBbbeeLevel(data, candidate),
        prefPoints: normalizePreferencePoints(data, candidate),
        compulsoryBriefing: normalizeCompulsoryBriefing(data, candidate)
    };

    debugLog(`[Tender Trace:${traceId}] [Tender Debug] Pure Extracted Qualifications:`, extractedAI);
    Sentry.addBreadcrumb({ category: "tender_ingest", message: "normalized qualification object", data: { extractedAI, traceId } });

    const reqsObj = (typeof data.requirements === 'object' && data.requirements !== null) 
        ? data.requirements as { additional_returnables?: unknown; notes?: unknown } 
        : {};
        
    const mappedAdditional = safeToString(reqsObj.additional_returnables || "");
    const mappedNotes = safeToString(reqsObj.notes || "");

    const finalMapped: ManualFormState = {
        ...prev,
        title: data.title || data.tender_description || prev.title,
        client: data.client_name || data.entity_name || prev.client,
        tenderNumber: data.tender_number || data.reference_number || prev.tenderNumber,
        tenderDescription: data.description || data.summary || prev.tenderDescription,
        closingDate: extractDate(data.closing_date) || extractDate(data.expiry_date) || extractDate(data.signature_date) || prev.closingDate,
        grade: extractedAI.grade || prev.grade,
        class: extractedAI.class || prev.class,
        bbbee: extractedAI.bbbee || prev.bbbee,
        prefPoints: extractedAI.prefPoints || prev.prefPoints,
        compulsoryBriefing: extractedAI.compulsoryBriefing ?? prev.compulsoryBriefing,
        additionalReturnables: mappedAdditional || prev.additionalReturnables,
        notes: mappedNotes || prev.notes,
        mandatoryDocs: normalizeTenderMandatoryDocs(data, prev.mandatoryDocs)
    };

    debugLog(`[Tender Trace:${traceId}] [Tender Debug] Final Qualification Mapping:`, {
        grade: finalMapped.grade,
        class: finalMapped.class,
        bbbee: finalMapped.bbbee,
        prefPoints: finalMapped.prefPoints,
        compulsoryBriefing: finalMapped.compulsoryBriefing,
        additionalReturnablesMapped: !!mappedAdditional,
        notesMapped: !!mappedNotes
    });

    return finalMapped;
};

type UploadState = "idle" | "uploading" | "processing" | "error" | "complete" | "blocked"

export default function TenderIngest() {
    const navigate = useNavigate()
    const [file, setFile] = useState<File | null>(null)
    const [status, setStatus] = useState<UploadState>("idle")
    const [progress, setProgress] = useState(0)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)
    const [processStep, setProcessStep] = useState<string>("")
    const [ingestMode, setIngestMode] = useState<"upload" | "manual">("upload")
    const [traceId, setTraceId] = useState<string>("")

    const {
        register,
        handleSubmit,
        reset,
        getValues,
        watch
    } = useForm({
        resolver: zodResolver(manualFormSchema),
        defaultValues: {
            title: "",
            client: "",
            tenderNumber: "",
            tenderDescription: "",
            closingDate: "",
            grade: "",
            class: "",
            bbbee: "",
            prefPoints: "",
            compulsoryBriefing: false,
            additionalReturnables: "",
            notes: "",
            mandatoryDocs: {
                cipc_cert: false, cidb_proof: false, sars_pin: false, csd_summary: false,
                coid_letter: false, bbbee_cert: false, vat_reg: false, uif_letter: false,
                paye_reg: false, bank_letter: false, sbd_6_1: false, ohs_plan: false, she_file: false
            }
        }
    });

    const manualForm = watch();
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        console.log(`[Tender Debug] Debug logging enabled: ${!import.meta.env.PROD || import.meta.env.VITE_ENABLE_TENDER_DEBUG === "true"}`);
    }, []);

    const processFile = async (rawFile: File) => {
        const id = generateTraceId();
        setTraceId(id);
        const prefix = `[Tender Trace:${id}]`;
        debugLog(`${prefix} tender file selected:`, rawFile.name);
        Sentry.addBreadcrumb({ 
            category: "tender_ingest", 
            message: "tender file selected", 
            data: { 
                fileType: rawFile.type || "unknown", 
                fileSize: rawFile.size, 
                step: "file_select",
                traceId: id 
            } 
        });

        try {
            const check = await TenderService.checkSubscriptionLimit()
            if (!check.allowed) {
                setErrorMsg(check.reason || "Limit reached")
                setStatus("blocked")
                return
            }
        } catch (err) {
            console.error("Limit check failed", err)
        }

        setFile(rawFile)
        setStatus("idle")
        setErrorMsg(null)
    }

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            processFile(e.target.files[0])
        }
    }

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault()
    }

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault()
        if (e.dataTransfer.files?.[0]) {
            processFile(e.dataTransfer.files[0])
        }
    }


    const onSubmit = async (manualForm: any) => {
        const activeTrace = traceId || "manual-entry-no-trace";
        const prefix = `[Tender Trace:${activeTrace}]`;

        debugLog(`${prefix} final mapped manual form values:`, manualForm)
        Sentry.addBreadcrumb({ category: "tender_ingest", message: "final mapped manual form values", data: { form: manualForm, traceId: activeTrace } });

        setStatus("processing")
        setProcessStep("Creating tender record...")

        try {
            debugLog(`${prefix} tender save start`);
            Sentry.addBreadcrumb({ category: "tender_ingest", message: "tender save start", data: { traceId: activeTrace } });
            // Dynamic import to avoid errors if not top-level yet
            const { TenderService } = await import("@/services/api")

            const res = await TenderService.createManualTender({
                title: manualForm.title,
                client_name: manualForm.client,
                tender_number: manualForm.tenderNumber,
                tender_description: manualForm.tenderDescription,
                closing_date: manualForm.closingDate,
                compulsory_briefing: manualForm.compulsoryBriefing,
                additional_returnables: manualForm.additionalReturnables,
                notes: manualForm.notes,
                preference_points: manualForm.prefPoints,
                requirements: {
                    cidb_grade: manualForm.grade,
                    cidb_class: manualForm.class,
                    min_bbbee_level: manualForm.bbbee,
                    mandatory_docs: manualForm.mandatoryDocs ? Object.entries(manualForm.mandatoryDocs).filter(([_, v]) => v).map(([k]) => k) : []
                }
            })

            if (res.error) {
                console.error(`${prefix} tender save failure:`, res.error);
                Sentry.captureException(new Error(`Tender Save Failed: ${res.error}`), { tags: { traceId: activeTrace } });
                throw new Error(res.error)
            }

            debugLog(`${prefix} tender save success`);
            Sentry.addBreadcrumb({ category: "tender_ingest", message: "tender save success", data: { traceId: activeTrace } });

            // Simulate a brief delay for UX
            await new Promise(r => setTimeout(r, 800))
            setStatus("complete")

        } catch (err: any) {
            Sentry.captureException(err, { tags: { traceId: activeTrace } });
            setErrorMsg(err.message)
            setStatus("error")
        }
    }

    const onError = (errs: any) => {
        const firstError = Object.values(errs)[0] as any;
        if (firstError?.message) {
            setErrorMsg(firstError.message);
        }
        setStatus("error");
    };

    const startUpload = async () => {
        if (!file) return
        const activeTrace = traceId || "missing-trace";
        const prefix = `[Tender Trace:${activeTrace}]`;

        // FEATURE GATE: DEEP_AI_ANALYSIS
        // We need to check if the user has access. We'll use the tier from context (which we need to get first)
        // Note: For now we'll do a quick check via the API or context.
        // Since we are inside the component, we can use useAuth hook if we import it.
        // Let's import useAuth.

        try {
            // 1. Uploading
            setStatus("uploading")
            setProcessStep("Uploading document...")

            // Dynamic import
            const { supabase } = await import("@/lib/supabase")
            const { CompanyService } = await import("@/services/api")
            const { FeatureGate } = await import("@/lib/features")
            // We need the user's tier. We can fetch it or trust the UI context. 
            // For strictness, checking the subscription limit (which we already do via API) is good, 
            // but for specific FEATURES like AI, we check the tier.

            // We'll trust the limit check we did earlier for "Tender Creation Access", 
            // but now we check "Deep Analysis Access".

            // Hack: Fetch subscription again or assume Pro for this specific functionality if not passed.
            // Better: useAuth() hook. I will add useAuth to the top of component in next step. 
            // For now, I will perform a safe check.

            await TenderService.checkSubscriptionLimit()
            // checkSubscriptionLimit returns allowed/reason. 
            // We can extend the API to return the PLAN name too, or fetch it.

            // If plan is FREE or STANDARD, maybe we restrict the *Depth* of analysis?
            // User requirement: "Teir 2 cant have for example unlimited tender it cant have deep AI analysis"
            // So Standard (Tier 2) -> No Deep Analysis.

            // Let's fetch the plan name directly to be safe.
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error("User not found")

            // Fixed: use maybeSingle() to prevent noisy 406 PGRST116 (0 rows) on free tier users
            const { data: sub } = await supabase.from('subscriptions').select('plan_name').eq('user_id', user.id).eq('status', 'active').maybeSingle()
            const tier = sub?.plan_name?.includes('Pro') ? 'Pro' : (sub?.plan_name?.includes('Standard') ? 'Standard' : 'Free')

            // Removed basic extraction block. Deep AI is gated later.

            const fileName = `${user.id}/tenders/${Date.now()}_${file.name}`
            debugLog(`${prefix} storage upload start + path:`, fileName);
            Sentry.addBreadcrumb({ category: "tender_ingest", message: "storage upload start", data: { step: "upload_start", traceId: activeTrace } });

            const { error: uploadError } = await supabase.storage
                .from('compliance') // MUST be compliance so Edge Function can read it
                .upload(fileName, file)

            if (uploadError) throw uploadError

            setProgress(50)

            // 2. Analyzing
            setStatus("processing")
            setProcessStep("AI is reading the tender document...")
            
            debugLog(`${prefix} analyze start`);
            Sentry.addBreadcrumb({ category: "tender_ingest", message: "analyze start", data: { traceId: activeTrace } });

            const { data, error: analyzeError } = await CompanyService.analyzeDocument(fileName, 'tender_document')

            if (analyzeError) {
                console.error(`${prefix} analyze failure:`, analyzeError);
                Sentry.addBreadcrumb({ category: "tender_ingest", message: "analyze failure", level: "error", data: { error: analyzeError, traceId: activeTrace } });
                throw new Error(analyzeError)
            }

            debugLog(`${prefix} analyze success`);
            debugLog(`${prefix} raw AI keys received:`, Object.keys(data || {}));
            Sentry.addBreadcrumb({ category: "tender_ingest", message: "analyze success", data: { keys: Object.keys(data || {}), traceId: activeTrace } });

            // Placeholder for deep strategy insights
            const insights = {
                available: FeatureGate.hasAccess(tier as any, 'DEEP_AI_ANALYSIS'),
                message: "Upgrade to unlock strategic insights"
            }
            console.log("[Tender Upload Debug] AI Insights status:", insights)

            // 3. Populate Form & Switch to Manual for Review
            const updatedForm = normalizeTenderAiData(data, getValues() as ManualFormState, activeTrace);
            reset(updatedForm);

            setStatus("idle")
            setIngestMode("manual")
            // Ideally show a success toast "Data extracted!"

        } catch (err: any) {
            console.error(`${prefix} upload/analyze error:`, err)
            Sentry.captureException(err, { tags: { traceId: activeTrace } });
            setErrorMsg(err.message || "Failed to analyze tender")
            setStatus("error")
        }
    }

    return (
        <div className="max-w-2xl mx-auto py-8">
            <button
                onClick={() => navigate("/tenders")}
                className="flex items-center text-sm text-gray-500 hover:text-gray-900 mb-6"
            >
                <ArrowLeft className="w-4 h-4 mr-1" />
                Back to Tenders
            </button>

            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Add New Tender</h1>

                {/* Mode Toggle */}
                <div className="bg-gray-100 p-1 rounded-lg flex text-sm font-medium">
                    <button
                        onClick={() => setIngestMode("upload")}
                        className={`px-3 py-1.5 rounded-md transition-all ${ingestMode === 'upload' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}
                    >
                        Upload PDF
                    </button>
                    <button
                        onClick={() => setIngestMode("manual")}
                        className={`px-3 py-1.5 rounded-md transition-all ${ingestMode === 'manual' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}
                    >
                        Manual Entry
                    </button>
                </div>
            </div>

            {ingestMode === 'upload' && (
                <p className="text-gray-600 mb-8">Upload a tender document to automatically extract requirements.</p>
            )}

            {ingestMode === 'manual' && (
                <p className="text-gray-600 mb-8">Manually define tender requirements.</p>
            )}

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8">

                {/* MANUAL FORM */}
                {ingestMode === 'manual' && (status === 'idle' || status === 'processing' || status === 'error') && (
                    <form onSubmit={handleSubmit(onSubmit, onError)} className="space-y-8">
                        {/* 1. Tender Basics */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">Tender Details</h3>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Tender Title</label>
                                <input
                                    required
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                    placeholder="e.g. N2 Highway Maintenance"
                                    {...register('title')}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Tender Number</label>
                                    <input
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                        placeholder="e.g. NRA-1234"
                                        {...register('tenderNumber')}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Issuing Entity</label>
                                    <input
                                        required
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                        placeholder="e.g. SANRAL, Eskom, etc."
                                        {...register('client')}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Closing Date</label>
                                <input
                                    type="date"
                                    required
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                    {...register('closingDate')}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Tender Description</label>
                                <textarea
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm min-h-[80px]"
                                    placeholder="e.g. High-level scope of work or project goals..."
                                    {...register('tenderDescription')}
                                />
                            </div>
                        </div>

                        {/* 2. Eligibility Requirements */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">Qualification Criteria</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Minimum CIDB Grade</label>
                                    <select
                                        className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors ${!manualForm.grade ? 'text-gray-400' : 'text-gray-900'}`}
                                        {...register('grade')}
                                    >
                                        <option value="" disabled className="text-gray-400">Choose CIDB Grade...</option>
                                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(g => <option key={g} value={g} className="text-gray-900">Grade {g}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Class of Work</label>
                                    <select
                                        className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors ${!manualForm.class ? 'text-gray-400' : 'text-gray-900'}`}
                                        {...register('class')}
                                    >
                                        <option value="" disabled className="text-gray-400">Choose Class...</option>
                                        {["CE", "GB", "ME", "EP"].map(c => <option key={c} value={c} className="text-gray-900">{c}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Minimum B-BBEE Level</label>
                                    <select
                                        className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors ${!manualForm.bbbee ? 'text-gray-400' : 'text-gray-900'}`}
                                        {...register('bbbee')}
                                    >
                                        <option value="" disabled className="text-gray-400">Choose B-BBEE Level...</option>
                                        {[1, 2, 3, 4, 5, 6, 7, 8].map(l => <option key={l} value={l} className="text-gray-900">Level {l}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Preference Points</label>
                                    <select
                                        className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors ${!manualForm.prefPoints ? 'text-gray-400' : 'text-gray-900'}`}
                                        {...register('prefPoints')}
                                    >
                                        <option value="" disabled className="text-gray-400">Choose Preference Points...</option>
                                        <option value="80/20" className="text-gray-900">80/20</option>
                                        <option value="90/10" className="text-gray-900">90/10</option>
                                    </select>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 pt-2">
                                <input
                                    type="checkbox"
                                    id="compulsoryBriefing"
                                    {...register('compulsoryBriefing')}
                                    className="rounded border-gray-300 text-primary focus:ring-primary"
                                />
                                <label htmlFor="compulsoryBriefing" className="text-sm font-medium text-gray-700 cursor-pointer">Require Compulsory Briefing</label>
                            </div>
                        </div>

                        {/* 3. Required Compliance Documents */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">Mandatory Returnables</h3>
                            <div className="grid grid-cols-2 gap-2 bg-gray-50 p-4 border border-gray-200 rounded-lg">
                                {Object.entries({
                                    cipc_cert: "CIPC Registration",
                                    cidb_proof: "CIDB Certificate",
                                    sars_pin: "SARS Tax PIN",
                                    csd_summary: "CSD Summary Report",
                                    coid_letter: "COID Letter of Good Standing",
                                    bbbee_cert: "B-BBEE Certificate",
                                    vat_reg: "VAT Registration",
                                    uif_letter: "UIF Compliance",
                                    paye_reg: "PAYE Registration",
                                    bank_letter: "Bank Confirmation",
                                    ohs_plan: "OHS Plan",
                                    she_file: "SHE File",
                                    sbd_6_1: "SBD 6.1 Form"
                                }).map(([key, label]) => (
                                    <div key={key} className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            id={`doc_${key}`}
                                            {...register(`mandatoryDocs.${key}` as any)}
                                            className="rounded border-gray-300 text-primary focus:ring-primary"
                                        />
                                        <label htmlFor={`doc_${key}`} className="text-sm text-gray-700 cursor-pointer">{label}</label>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* 4. Additional Requirements */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">Other Conditions</h3>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Additional Mandatory Returnables</label>
                                <textarea
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm min-h-[80px]"
                                    placeholder="e.g. Schedule of Subcontractors, Key Personnel CVs..."
                                    {...register('additionalReturnables')}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Special Conditions / Notes</label>
                                <textarea
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm min-h-[80px]"
                                    placeholder="e.g. Must attend site inspection, strict local content..."
                                    {...register('notes')}
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={status === 'processing'}
                            className="w-full py-3 bg-black text-white rounded-lg font-medium hover:bg-gray-800 transition-colors mt-6 flex items-center justify-center"
                        >
                            {status === 'processing' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            {status === 'processing' ? 'Creating...' : 'Create Tender'}
                        </button>
                    </form>
                )}


                {/* UPLOAD UI (IDLE STATE) */}
                {ingestMode === 'upload' && status === "idle" && !file && (
                    <div
                        onClick={() => inputRef.current?.click()}
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                        className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center hover:border-primary hover:bg-primary/5 transition-all cursor-pointer"
                    >
                        <input ref={inputRef} type="file" className="hidden" accept=".pdf,.docx" onChange={handleFileSelect} />
                        <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Upload className="w-6 h-6 text-primary" />
                        </div>
                        <p className="text-lg font-medium text-gray-900">Click to upload or drag and drop</p>
                        <p className="text-sm text-gray-500 mt-2">Legal documents, RFP, or SoW</p>
                    </div>
                )}

                {/* UPLOAD UI (SELECTED/UPLOADING) */}
                {ingestMode === 'upload' && file && (status === "idle" || status === "uploading") && (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white rounded shadow-sm">
                                    <FileText className="w-6 h-6 text-blue-600" />
                                </div>
                                <div>
                                    <p className="font-medium text-gray-900">{file.name}</p>
                                    <p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                                </div>
                            </div>
                            {status === "idle" && (
                                <button onClick={() => setFile(null)} className="text-gray-400 hover:text-red-500">
                                    <X className="w-5 h-5" />
                                </button>
                            )}
                        </div>

                        {status === "uploading" && (
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs font-medium text-gray-500">
                                    <span>{processStep}</span>
                                    <span>{progress}%</span>
                                </div>
                                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-primary transition-all duration-300 ease-out"
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        {status === "idle" && (
                            <button
                                onClick={startUpload}
                                className="w-full py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors"
                            >
                                Start Analysis
                            </button>
                        )}
                    </div>
                )}

                {/* PROCESSING STATE (AI / Manual) */}
                {status === "processing" && ingestMode === 'upload' && (
                    <div className="text-center py-8">
                        <div className="relative w-16 h-16 mx-auto mb-6">
                            <div className="absolute inset-0 border-4 border-gray-100 rounded-full"></div>
                            <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                            <Loader2 className="absolute inset-0 m-auto w-6 h-6 text-primary animate-pulse" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">Analyzing Tender</h3>
                        <p className="text-gray-500 text-sm animate-pulse">{processStep}</p>
                    </div>
                )}

                {/* COMPLETED STATE */}
                {status === "complete" && (
                    <div className="text-center py-6">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <CheckCircle2 className="w-8 h-8 text-green-600" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 mb-2">{ingestMode === 'manual' ? 'Tender Created' : 'Analysis Complete'}</h3>
                        <p className="text-gray-600 mb-8">{ingestMode === 'manual' ? 'Your test tender has been created successfully.' : "We've extracted specific requirements and compliance needs."}</p>

                        <div className="flex gap-3 justify-center">
                            <button
                                onClick={() => navigate("/tenders")}
                                className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50"
                            >
                                Return to List
                            </button>
                            <button
                                onClick={() => navigate("/tenders")} // Ideally go to specific ID if we returned it, but list is fine for now
                                className="px-6 py-2 bg-black text-white rounded-lg font-medium hover:bg-gray-800"
                            >
                                View Results
                            </button>
                        </div>
                    </div>
                )}

                {/* BLOCKED STATE */}
                {status === "blocked" && (
                    <div className="text-center py-6">
                        <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <AlertTriangle className="w-8 h-8 text-orange-600" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 mb-2">Limit Reached</h3>
                        <p className="text-gray-600 mb-8 max-w-sm mx-auto">{errorMsg}</p>

                        <button
                            onClick={() => navigate('/pricing')}
                            className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-bold hover:shadow-lg transition-all"
                        >
                            Upgrade to Unlimited
                        </button>
                        <button
                            onClick={() => { setStatus("idle"); setFile(null); }}
                            className="block w-full mt-4 text-sm text-gray-400 hover:text-gray-600"
                        >
                            Cancel
                        </button>
                    </div>
                )}

                {/* ERROR STATE */}
                {status === "error" && (
                    <div className="text-center py-6">
                        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <AlertTriangle className="w-8 h-8 text-red-600" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 mb-2">Processing Failed</h3>
                        <p className="text-gray-600 mb-8">{errorMsg || "An unexpected error occurred."}</p>

                        <button
                            onClick={() => { setStatus("idle"); setFile(null); }}
                            className="px-6 py-2 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800"
                        >
                            Try Again
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
