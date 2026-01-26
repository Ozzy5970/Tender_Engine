import { useNavigate } from "react-router-dom"
import { useEffect, useState } from "react"
import type { FormEvent } from "react"
import { TemplateService, AdminService, CompanyService } from "@/services/api"
import { Trash2, FileText, Loader2, Plus, Archive, Wand2, Download, AlertCircle, CheckCircle2, History, AlertTriangle } from "lucide-react"
import { COMPLIANCE_CATEGORIES, DOCUMENT_TYPES } from "@/lib/taxonomy"
import type { DocTypeKey } from "@/lib/taxonomy"
import ConfirmationModal from "@/components/ConfirmationModal"
import { motion } from "framer-motion"

// Strict Title Enforcement
const OFFICIAL_TITLES: Record<string, string> = {
    "SBD 1": "Invitation to Bid",
    "SBD 4": "Declaration of Interest",
    "SBD 6.1": "Preference Points Claim Form (B-BBEE)",
    "SBD 6.2": "Declaration Certificate for Local Production",
    "SBD 8": "Declaration of Bidder's Past SCM Practices",
    "SBD 9": "Certificate of Independent Bid Determination",
    "MBD 1": "Invitation to Bid (Municipal)",
    "MBD 4": "Declaration of Interest (Municipal)",
    "MBD 6.1": "Preference Points Claim Form (MBD)",
    "MBD 8": "Declaration of Bidder's Past SCM Practices (Municipal)",
    "MBD 9": "Certificate of Independent Bid Determination (Municipal)",
    "SWORN AFFIDAVIT": "B-BBEE Sworn Affidavit - EME/QSE"
}

const OFFICIAL_DESCRIPTIONS: Record<string, string> = {
    "SBD 1": "Foundational document outlining the terms, conditions, and bidder details for the tender response.",
    "SBD 4": "Mandatory declaration of interest to identify conflict of interest or governmental relationships.",
    "SBD 6.1": "Claim form for B-BBEE preference points in terms of the Preferential Procurement Regulations.",
    "SBD 6.2": "Declaration required for designated sectors to ensure local production and content compliance.",
    "SBD 8": "Declaration used to prevent abuse of the Supply Chain Management system.",
    "SBD 9": "Certificate ensuring the bid was determined independently without collusion.",
    "MBD 1": "Foundational municipal bid document outlining terms and bidder details.",
    "MBD 4": "Mandatory municipal declaration of interest to identify conflict of interest.",
    "MBD 6.1": "Municipal claim form for B-BBEE preference points.",
    "MBD 8": "Declaration to prevent abuse of the Municipal Supply Chain Management system.",
    "MBD 9": "Certificate ensuring the municipal bid was determined independently.",
    "SWORN AFFIDAVIT": "Official sworn affidavit confirming B-BBEE status for Exempted Micro Enterprises (Emerging)."
}

export default function AdminTemplates() {
    const navigate = useNavigate()
    const [templates, setTemplates] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [showUpload, setShowUpload] = useState(false)
    const [showArchived, setShowArchived] = useState(false)

    // Form State
    const [form, setForm] = useState({ title: "", code: "", category: "General", description: "" })
    const [file, setFile] = useState<File | null>(null)
    const [uploading, setUploading] = useState(false)
    const [analyzing, setAnalyzing] = useState(false)
    const [duplicateCheck, setDuplicateCheck] = useState<{ exists: boolean, title: string } | null>(null)

    // Modal State
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        title: string;
        description: string;
        onConfirm: () => void;
        variant?: "danger" | "warning";
    }>({ isOpen: false, title: "", description: "", onConfirm: () => { } })

    useEffect(() => {
        loadTemplates()
    }, [showArchived])

    const loadTemplates = async () => {
        setLoading(true)
        const { data } = await TemplateService.getAll(showArchived)
        if (data) setTemplates(data as any[])
        setLoading(false)
    }

    // AI Analysis
    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            const f = e.target.files[0]
            setFile(f)
            setAnalyzing(true)
            try {
                // Upload temp
                const tempName = `temp/${Date.now()}_${f.name}`
                const { supabase } = await import("@/lib/supabase")
                await supabase.storage.from('compliance').upload(tempName, f)

                const { data, error } = await CompanyService.analyzeDocument(tempName, 'template_analysis')
                if (error) throw new Error(error)
                if (data && data.error) throw new Error(data.error)

                if (data) {
                    const extractedCode = data.code || ""
                    const cleanCode = extractedCode.toUpperCase().replace(/\s+/g, ' ').trim()

                    let finalTitle = OFFICIAL_TITLES[cleanCode] || data.title || ""
                    let finalCategory: DocTypeKey | "General" = "General"

                    // Offline Fallback Logic: If AI returned generic "Manual Entry", try to guess from Filename
                    const cleanFileName = f.name.replace(/\.[^/.]+$/, "").trim() // Remove extension
                    if (finalTitle.includes("Manual Entry") || !finalTitle) {
                        finalTitle = cleanFileName

                        // Try to extract SBD code from filename
                        // sbdMatch removed
                        // sbdMatch logic moved to setForm below
                    }

                    // Intelligent Category Logic using Taxonomy
                    if (cleanCode.includes("SBD") || cleanCode.includes("MBD")) finalCategory = "General"

                    // Specific Overrides for SBD 6.1
                    if (cleanCode.includes("SBD 6.1") || finalTitle.includes("SBD 6.1")) {
                        finalCategory = "sbd_6_1"
                        // Ensure the detection logic doesn't get overwritten by 'affidavit' check below
                    }

                    // Try to map to specific types based on Title OR Filename
                    const paramToCheck = (finalTitle + " " + cleanFileName).toLowerCase()
                    if (paramToCheck.includes("cipc")) finalCategory = "cipc_cert"
                    if (paramToCheck.includes("tax")) finalCategory = "sars_pin"

                    // Only default to 'bbbee_cert' if we haven't already identified it as SBD 6.1
                    if (finalCategory !== "sbd_6_1" && (paramToCheck.includes("b-bbee") || paramToCheck.includes("affidavit"))) {
                        finalCategory = "bbbee_cert"
                    }

                    setForm(prev => {
                        // Improved Regex for SBD in filename
                        // Matches: SBD 4, SBD-4, SBD4, sbd_4
                        // Improved Regex for SBD in filename
                        // Matches: SBD 4, SBD-4, SBD4, sbd_4
                        const sbdMatch = cleanFileName.match(/SBD[\s\-_]*([\d\.]+)/i)

                        let derivedCode = cleanCode
                        let derivedTitle = finalTitle
                        let derivedDesc = data.description || prev.description

                        // Hybrid Logic: If we detect an SBD code via regex (and AI didn't catch a conflicting one), enforce Official Taxonomy
                        if ((cleanCode === "GENERAL" || !cleanCode || derivedTitle.match(/Manual|Document/i)) && sbdMatch) {
                            derivedCode = `SBD ${sbdMatch[1]}`

                            // 🚀 Power-Up: Use Dictionary for perfect Title/Desc
                            if (OFFICIAL_TITLES[derivedCode]) {
                                derivedTitle = OFFICIAL_TITLES[derivedCode]
                            }
                            if (OFFICIAL_DESCRIPTIONS[derivedCode]) {
                                derivedDesc = OFFICIAL_DESCRIPTIONS[derivedCode]
                            }
                        }

                        // Code Fallback for General Category
                        if (derivedCode === "GENERAL") derivedCode = ""

                        return {
                            ...prev,
                            title: derivedTitle,
                            code: derivedCode,
                            category: finalCategory,
                            description: derivedDesc
                        }
                    })

                    // Immediate Duplicate Check
                    const checkCode = cleanCode || ""
                    if (checkCode && checkCode !== "GENERAL") {
                        const match = templates.find(t => t.isActive && t.code.toUpperCase() === checkCode)
                        if (match) setDuplicateCheck({ exists: true, title: match.title })
                        else setDuplicateCheck(null)
                    }

                    // Smart Suggestion (Non-blocking alert)
                    // Removed alert logic in favor of UI indication
                }
            } catch (err: any) {
                console.error(err)
                alert("AI Analysis Failed: " + err.message)
            }
            setAnalyzing(false)
        }
    }

    const handleUpload = async (e: FormEvent) => {
        e.preventDefault()
        if (!file) return
        setUploading(true)

        // Refined Duplicate Logic
        const normalize = (s: string) => s.trim().toUpperCase()
        const isGeneral = normalize(form.code) === "GENERAL"

        const existing = templates.find(t => {
            if (!t.is_active) return false
            const matchCode = normalize(t.code) === normalize(form.code)
            if (!matchCode) return false
            if (isGeneral) return normalize(t.title) === normalize(form.title)
            return true
        })

        if (existing) {
            setConfirmModal({
                isOpen: true,
                title: "Replace Template?",
                description: `A template with code "${existing.code}" already exists ("${existing.title}"). Do you want to archive it and upload this new version?`,
                variant: 'warning',
                onConfirm: async () => {
                    setConfirmModal(prev => ({ ...prev, isOpen: false }))
                    await AdminService.archiveTemplate(existing.id)
                    await performUpload()
                }
            })
            setUploading(false)
            return
        }

        await performUpload()
    }

    const performUpload = async () => {
        setUploading(true)

        if (!file) return
        const { error } = await AdminService.uploadTemplate(file, form.title, form.code, form.category, form.description)
        if (error) {
            setConfirmModal({
                isOpen: true,
                title: "Upload Failed",
                description: error,
                variant: 'danger',
                onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false }))
            })
        }
        else {
            setShowUpload(false)
            setFile(null)
            setForm({ title: "", code: "", category: "General", description: "" })
            setDuplicateCheck(null)
            loadTemplates()
        }
        setUploading(false)
    }

    const handleDelete = async (id: string, url: string) => {
        setConfirmModal({
            isOpen: true,
            title: "Delete Template",
            description: "Are you sure you want to permanently delete this template? This cannot be undone.",
            variant: 'danger',
            onConfirm: async () => {
                await AdminService.deleteTemplate(id, url)
                loadTemplates()
                setConfirmModal(prev => ({ ...prev, isOpen: false }))
            }
        })
    }

    const toggleArchive = async (template: any) => {
        if (template.is_active) await AdminService.archiveTemplate(template.id)
        else await AdminService.updateTemplate(template.id, { is_active: true })
        loadTemplates()
    }

    if (loading && !templates.length) return <div className="p-8"><Loader2 className="animate-spin" /></div>

    // Render Logic
    // We want to group by COMPLIANCE_CATEGORIES first (Tax, Company...)


    const TemplateCard = ({ template }: { template: any }) => (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`bg-white border rounded-lg p-3 shadow-sm hover:shadow-md transition-all flex justify-between items-start group ${!template.is_active ? 'opacity-60 grayscale' : ''}`}
        >
            <div className="flex-1 min-w-0 mr-3">
                <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-mono font-bold bg-gray-100 text-gray-600 px-1.5 rounded">
                        {template.code}
                    </span>
                    {template.download_count > 0 && (
                        <span className="text-[10px] font-mono font-bold bg-blue-50 text-blue-600 px-1.5 rounded flex items-center">
                            <Download className="w-2.5 h-2.5 mr-1" />
                            {template.download_count}
                        </span>
                    )}
                    {!template.is_active && <span className="text-[10px] bg-red-100 text-red-600 px-1 rounded">ARCHIVED</span>}
                </div>
                <h4 className="text-sm font-medium text-gray-900 truncate" title={template.title}>{template.title}</h4>
                <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">{template.description}</p>
            </div>

            <div className="flex flex-col gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                    onClick={async () => {
                        const url = await TemplateService.download(template)
                        window.open(url, '_blank')
                    }}
                    className="p-1.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100" title="Download">
                    <Download className="w-3 h-3" />
                </button>
                <button onClick={() => toggleArchive(template)} className="p-1.5 bg-gray-50 text-gray-500 rounded hover:bg-orange-50 hover:text-orange-600" title="Archive">
                    <Archive className="w-3 h-3" />
                </button>
                <button onClick={() => handleDelete(template.id, template.file_url)} className="p-1.5 bg-gray-50 text-gray-500 rounded hover:bg-red-50 hover:text-red-600" title="Delete">
                    <Trash2 className="w-3 h-3" />
                </button>
            </div>
        </motion.div>
    )

    return (
        <div className="max-w-7xl mx-auto py-8 px-4 font-sans">
            {/* Header */}
            <div className="flex justify-between items-center mb-10">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Compliance Templates</h1>
                    <p className="text-gray-500 mt-1">Manage standard forms for each compliance section.</p>
                </div>
                <div className="flex gap-3">
                    <button onClick={() => navigate('/admin/templates/history')} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 flex items-center">
                        <History className="w-4 h-4 mr-2" /> Audit Log
                    </button>
                    <button onClick={() => setShowArchived(!showArchived)} className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50">
                        {showArchived ? "Hide Archived" : "Show Archived"}
                    </button>
                    <button onClick={() => setShowUpload(!showUpload)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm flex items-center">
                        <Plus className="w-4 h-4 mr-2" /> New Template
                    </button>
                </div>
            </div>

            {/* Upload Modal */}
            {showUpload && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-50 duration-200">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-lg text-gray-900 flex items-center">
                                <Wand2 className="w-5 h-5 mr-2 text-blue-600" /> Upload Template
                            </h3>
                            <button onClick={() => setShowUpload(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                        </div>

                        <div className="p-8">
                            {analyzing && (
                                <div className="mb-6 bg-blue-50 text-blue-700 p-4 rounded-lg flex items-center animate-pulse">
                                    <Wand2 className="w-5 h-5 mr-3" />
                                    Analyzing document structure...
                                </div>
                            )}

                            <form onSubmit={handleUpload} className="space-y-6">
                                {duplicateCheck && duplicateCheck.exists && (
                                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 animate-pulse">
                                        <AlertTriangle className="w-5 h-5 text-red-600" />
                                        <div>
                                            <p className="text-sm font-bold text-red-900">Duplicate Code Detected</p>
                                            <p className="text-xs text-red-700">Code "{form.code}" is already used by "{duplicateCheck.title}". Uploading will offer replacement.</p>
                                        </div>
                                    </div>
                                )}

                                {!file ? (
                                    <div className="border-2 border-dashed border-gray-300 rounded-xl p-10 text-center hover:border-blue-500 hover:bg-blue-50 transition-all cursor-pointer relative">
                                        <input type="file" required accept=".pdf" onChange={handleFileSelect} className="absolute inset-0 opacity-0 cursor-pointer" />
                                        <Download className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                                        <p className="font-medium text-gray-900">Drop PDF here to upload</p>
                                        <p className="text-sm text-gray-500">AI will auto-detect the section</p>
                                    </div>
                                ) : (
                                    <div className="flex items-center p-3 bg-green-50 text-green-700 rounded-lg border border-green-200">
                                        <CheckCircle2 className="w-5 h-5 mr-2" />
                                        <span className="font-medium truncate flex-1">{file.name}</span>
                                        <button type="button" onClick={() => setFile(null)} className="text-sm underline ml-2">Change</button>
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-5">
                                    <div>
                                        <label className="label-text text-xs font-bold text-gray-500 uppercase">Applicable Section</label>
                                        <select
                                            className="w-full mt-1 p-2 border rounded-lg bg-gray-50 text-sm"
                                            value={form.category}
                                            onChange={e => setForm({ ...form, category: e.target.value })}
                                        >
                                            <option value="General">General / Standard Bidding (SBD)</option>
                                            <optgroup label="Specific Compliance Sections">
                                                {Object.entries(DOCUMENT_TYPES).map(([key, def]) => (
                                                    <option key={key} value={key}>{def.label}</option>
                                                ))}
                                            </optgroup>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="label-text text-xs font-bold text-gray-500 uppercase">Official Code</label>
                                        <input
                                            className="w-full mt-1 p-2 border rounded-lg bg-gray-50 text-sm font-mono"
                                            placeholder="SBD 4"
                                            value={form.code}
                                            onChange={e => setForm({ ...form, code: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="label-text text-xs font-bold text-gray-500 uppercase">Title</label>
                                    <input
                                        className="w-full mt-1 p-2 border rounded-lg bg-gray-50 font-medium"
                                        placeholder="Document Title"
                                        value={form.title}
                                        onChange={e => setForm({ ...form, title: e.target.value })}
                                    />
                                </div>

                                <div>
                                    <label className="label-text text-xs font-bold text-gray-500 uppercase">Description</label>
                                    <textarea
                                        className="w-full mt-1 p-2 border rounded-lg bg-gray-50 text-sm h-20"
                                        placeholder="What is this used for?"
                                        value={form.description}
                                        onChange={e => setForm({ ...form, description: e.target.value })}
                                    />
                                </div>

                                <div className="flex justify-end pt-4">
                                    <button type="button" onClick={() => setShowUpload(false)} className="px-5 py-2 text-gray-600 hover:bg-gray-100 rounded-lg mr-2">Cancel</button>
                                    <button type="submit" disabled={uploading} className="px-5 py-2 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700">
                                        {uploading ? "Saving..." : "Save Template"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Render Standard SBD / General First */}
            <div className="mb-12 border border-gray-100 rounded-2xl p-6 bg-white shadow-sm">
                <div className="flex items-center mb-6 pb-4 border-b border-gray-100">
                    <div className="bg-blue-50 p-2 rounded-lg mr-3">
                        <FileText className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Standard Bidding Documents (SBD)</h2>
                        <p className="text-sm text-gray-500">Universal government forms applicable to most tenders.</p>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {templates.filter(t => t.category === "General" && !t.code.startsWith("MBD")).map(t => (
                        <TemplateCard key={t.id} template={t} />
                    ))}
                    {templates.filter(t => t.category === "General" && !t.code.startsWith("MBD")).length === 0 && (
                        <p className="text-gray-400 text-sm italic col-span-full py-4 text-center border border-dashed rounded-lg">No standard SBD forms uploaded yet.</p>
                    )}
                </div>
            </div>

            {/* Render Municipal MBD Next */}
            <div className="mb-12 border border-gray-100 rounded-2xl p-6 bg-white shadow-sm">
                <div className="flex items-center mb-6 pb-4 border-b border-gray-100">
                    <div className="bg-purple-50 p-2 rounded-lg mr-3">
                        <FileText className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Municipal Bidding Documents (MBD)</h2>
                        <p className="text-sm text-gray-500">Specific forms for municipal and local government tenders.</p>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {templates.filter(t => t.category === "General" && t.code.startsWith("MBD")).map(t => (
                        <TemplateCard key={t.id} template={t} />
                    ))}
                    {templates.filter(t => t.category === "General" && t.code.startsWith("MBD")).length === 0 && (
                        <p className="text-gray-400 text-sm italic col-span-full py-4 text-center border border-dashed rounded-lg">No municipal MBD forms uploaded yet.</p>
                    )}
                </div>
            </div>

            {/* Render Category Grouped Sections as Gap Analysis Tables */}
            {Object.entries(COMPLIANCE_CATEGORIES).map(([key, label]) =>
                renderSection(key, label)
            )}

            <ConfirmationModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmModal.onConfirm}
                title={confirmModal.title}
                description={confirmModal.description}
                variant={confirmModal.variant as any}
            />
        </div>
    )

    // Helper functions need to be inside component scope or props passed. 
    // Re-defining renderSection here to access state.
    function renderSection(categoryKey: string, label: string) {
        // 1. Get all Doc Types for this Category
        const docTypes = Object.entries(DOCUMENT_TYPES)
            .filter(([_, def]) => def.category === categoryKey)

        if (docTypes.length === 0) return null

        return (
            <div key={categoryKey} className="mb-12 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="bg-gray-50/50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                    <h2 className="text-lg font-bold text-gray-900">{label}</h2>
                    <span className="text-xs font-medium text-gray-500 bg-white px-2 py-1 rounded border border-gray-200">
                        {docTypes.length} Requirements
                    </span>
                </div>

                <div className="divide-y divide-gray-100">
                    {/* Iterate each strict User Requirement to show gaps */}
                    {docTypes.map(([typeKey, def]) => {
                        // Find templates linked precisely to this typeKey
                        const linkedTemplate = templates.find(t => t.category === typeKey && t.is_active)
                        const archivedCount = templates.filter(t => t.category === typeKey && !t.is_active).length

                        return (
                            <div key={typeKey} className="grid grid-cols-1 md:grid-cols-12 gap-6 p-6 hover:bg-slate-50 transition-colors group">
                                {/* Left: User Requirement (The "Gap") */}
                                <div className="md:col-span-4">
                                    <div className="flex items-start gap-3">
                                        <div className={`mt-1 p-1.5 rounded-md ${linkedTemplate ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                                            {linkedTemplate ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-gray-900 text-sm">{def.label}</h3>
                                            <div className="flex items-center gap-2 mt-1">
                                                {def.mandatory ? (
                                                    <span className="text-[10px] uppercase font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">Mandatory</span>
                                                ) : (
                                                    <span className="text-[10px] uppercase font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">Optional</span>
                                                )}
                                                {archivedCount > 0 && showArchived && (
                                                    <span className="text-[10px] text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
                                                        {archivedCount} Archived
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Right: The Template (The "Plug") */}
                                <div className="md:col-span-8 flex items-center">
                                    {linkedTemplate ? (
                                        <div className="w-full">
                                            <TemplateCard template={linkedTemplate} />
                                        </div>
                                    ) : (
                                        <div className="w-full border-2 border-dashed border-gray-200 rounded-xl p-4 flex items-center justify-between group-hover:border-blue-300 group-hover:bg-blue-50/50 transition-all">
                                            <div className="flex items-center text-gray-400 group-hover:text-blue-600">
                                                <AlertCircle className="w-5 h-5 mr-2" />
                                                <span className="text-sm font-medium">No template uploaded for this section.</span>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    setForm(prev => ({ ...prev, category: typeKey, code: "", title: "", description: "" }))
                                                    setShowUpload(true)
                                                }}
                                                className="text-sm font-semibold text-blue-600 bg-white border border-blue-200 px-3 py-1.5 rounded-lg shadow-sm hover:bg-blue-600 hover:text-white transition-all flex items-center"
                                            >
                                                <Plus className="w-3 h-3 mr-1.5" />
                                                Upload Template
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        )
    }
}
