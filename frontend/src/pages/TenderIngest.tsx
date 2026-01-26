import { useState, useRef } from "react"
import { Upload, X, FileText, Loader2, CheckCircle2, AlertTriangle, ArrowLeft } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { TenderService } from "@/services/api"
// import { cn } from "@/lib/utils"

type UploadState = "idle" | "uploading" | "processing" | "error" | "complete" | "blocked"

export default function TenderIngest() {
    const navigate = useNavigate()
    const [file, setFile] = useState<File | null>(null)
    const [status, setStatus] = useState<UploadState>("idle")
    const [progress, setProgress] = useState(0)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)
    const [processStep, setProcessStep] = useState<string>("")
    const [ingestMode, setIngestMode] = useState<"upload" | "manual">("upload")

    // Manual Form State
    const [manualForm, setManualForm] = useState({
        title: "",
        client: "",
        closingDate: "",
        grade: "1",
        class: "CE",
        bbbee: "1",
        mandatory: false
    })

    const inputRef = useRef<HTMLInputElement>(null)

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            // Check Limits First
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

            setFile(e.target.files[0])
            setStatus("idle")
            setErrorMsg(null)
        }
    }


    const validateForm = () => {
        // Validation Logic

        // 1. Title Check
        if (manualForm.title.length < 3) {
            setErrorMsg("VAL_TITLE_SHORT: Tender Name must be at least 3 characters.")
            return false
        }

        // 2. Client Check
        if (manualForm.client.length < 3) {
            setErrorMsg("VAL_CLIENT_SHORT: Client Name must be at least 3 characters.")
            return false
        }

        // 3. Date Check (Crucial: No Past Dates)
        if (!manualForm.closingDate) {
            setErrorMsg("VAL_DATE_EMPTY: Closing Date is required.")
            return false
        }
        const closing = new Date(manualForm.closingDate)
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        if (closing < today) {
            setErrorMsg(`VAL_DATE_PAST: Closing Date cannot be in the past (${manualForm.closingDate}).`)
            return false
        }

        return true
    }

    const submitManual = async (e: React.FormEvent) => {
        e.preventDefault()

        // Run Validation
        if (!validateForm()) {
            setStatus("error")
            return
        }

        setStatus("processing")
        setProcessStep("Creating tender record...")

        try {
            // Dynamic import to avoid errors if not top-level yet
            const { TenderService } = await import("@/services/api")

            const res = await TenderService.createManualTender({
                title: manualForm.title,
                client_name: manualForm.client,
                closing_date: manualForm.closingDate,
                requirements: {
                    cidb_grade: manualForm.grade,
                    cidb_class: manualForm.class,
                    min_bbbee_level: manualForm.bbbee,
                    mandatory_docs: manualForm.mandatory
                }
            })

            if (res.error) {
                throw new Error(res.error)
            }

            // Simulate a brief delay for UX
            await new Promise(r => setTimeout(r, 800))
            setStatus("complete")

        } catch (err: any) {
            setErrorMsg(err.message)
            setStatus("error")
        }
    }

    const startUpload = async () => {
        if (!file) return

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
            const { data: sub } = await supabase.from('subscriptions').select('plan_name').eq('user_id', user?.id).eq('status', 'active').single()
            const tier = sub?.plan_name?.includes('Pro') ? 'Pro' : (sub?.plan_name?.includes('Standard') ? 'Standard' : 'Free')

            if (!FeatureGate.hasAccess(tier as any, 'DEEP_AI_ANALYSIS')) {
                // If they don't have deep analysis, they can still upload, but we won't run the heavy AI.
                // Or we block the "Upload PDF" mode entirely?
                // "Tier 2 ... cant have deep AI analysis"
                // So we should fail or fallback to basic.

                // Let's BLOCK it for now as "Premium Feature" and suggest Manual Entry.
                throw new Error(`AI Analysis is a Pro feature. You are on ${tier}. Please use Manual Entry or Upgrade.`)
            }

            const fileName = `tenders/${Date.now()}_${file.name}`
            const { error: uploadError } = await supabase.storage
                .from('tenders') // Ensure this bucket exists or use compliance/tenders
                .upload(fileName, file)

            if (uploadError) throw uploadError

            setProgress(50)

            // 2. Analyzing
            setStatus("processing")
            setProcessStep("AI is reading the tender document...")

            const { data, error: analyzeError } = await CompanyService.analyzeDocument(fileName, 'tender_document')

            if (analyzeError) throw new Error(analyzeError)

            // 3. Populate Form & Switch to Manual for Review
            setManualForm({
                title: data.title || manualForm.title,
                client: data.client_name || manualForm.client,
                closingDate: data.closing_date ? data.closing_date.split('T')[0] : manualForm.closingDate,
                grade: data.cidb_grade || manualForm.grade,
                class: data.cidb_class || manualForm.class,
                bbbee: data.min_bbbee_level || manualForm.bbbee,
                mandatory: true // Assume true if we parsed it
            })

            setStatus("idle")
            setIngestMode("manual")
            // Ideally show a success toast "Data extracted!"

        } catch (err: any) {
            console.error(err)
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
                <p className="text-gray-600 mb-8">Upload a tender document (PDF/DOCX) for automatic analysis.</p>
            )}

            {ingestMode === 'manual' && (
                <p className="text-gray-600 mb-8">Manually enter tender details to create a quick test case.</p>
            )}

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8">

                {/* MANUAL FORM */}
                {ingestMode === 'manual' && (status === 'idle' || status === 'processing' || status === 'error') && (
                    <form onSubmit={submitManual} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Tender Name</label>
                            <input
                                required
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                placeholder="e.g. N2 Highway Maintenance"
                                value={manualForm.title}
                                onChange={e => setManualForm({ ...manualForm, title: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Client</label>
                            <input
                                required
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                placeholder="e.g. SANRAL"
                                value={manualForm.client}
                                onChange={e => setManualForm({ ...manualForm, client: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Closing Date</label>
                            <input
                                type="date"
                                required
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                value={manualForm.closingDate}
                                onChange={e => setManualForm({ ...manualForm, closingDate: e.target.value })}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Required CIDB Grade</label>
                                <select
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                                    value={manualForm.grade}
                                    onChange={e => setManualForm({ ...manualForm, grade: e.target.value })}
                                >
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(g => <option key={g} value={g}>{g}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
                                <select
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                                    value={manualForm.class}
                                    onChange={e => setManualForm({ ...manualForm, class: e.target.value })}
                                >
                                    {["CE", "GB", "ME", "EP"].map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Min B-BBEE Level</label>
                            <select
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                                value={manualForm.bbbee}
                                onChange={e => setManualForm({ ...manualForm, bbbee: e.target.value })}
                            >
                                {[1, 2, 3, 4, 5, 6, 7, 8].map(l => <option key={l} value={l}>Level {l}</option>)}
                            </select>
                        </div>

                        <div className="flex items-center gap-2 pt-2">
                            <input
                                type="checkbox"
                                id="mandatory"
                                checked={manualForm.mandatory}
                                onChange={e => setManualForm({ ...manualForm, mandatory: e.target.checked })}
                                className="rounded border-gray-300 text-primary focus:ring-primary"
                            />
                            <label htmlFor="mandatory" className="text-sm text-gray-700 cursor-pointer">Require Standard Mandatory Documents (Tax, CIPC, COID)</label>
                        </div>

                        <button
                            type="submit"
                            disabled={status === 'processing'}
                            className="w-full py-3 bg-black text-white rounded-lg font-medium hover:bg-gray-800 transition-colors mt-4 flex items-center justify-center"
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
