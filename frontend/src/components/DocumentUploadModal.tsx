
import { useState, useEffect } from "react"
import { X, UploadCloud, FileText, Loader2, Save, Sparkles, AlertTriangle, XCircle } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { DOCUMENT_TYPES } from "@/lib/taxonomy"
import { CompanyService } from "@/services/api"
// import type { DocTypeKey } from "@/lib/taxonomy"

interface DocumentUploadModalProps {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
    category: string
    docType: string
    title: string
    existingDoc?: boolean // New prop to signal replacement
}

export default function DocumentUploadModal({ isOpen, onClose, onSuccess, category, docType, title, existingDoc = false }: DocumentUploadModalProps) {
    const [uploading, setUploading] = useState(false)
    const [analyzing, setAnalyzing] = useState(false)
    const [metadata, setMetadata] = useState<any>({})
    const [fileToUpload, setFileToUpload] = useState<File | null>(null)
    const [isValid, setIsValid] = useState<boolean>(true)
    const [override, setOverride] = useState(false)
    const [aiFailed, setAiFailed] = useState(false)
    const warnings = metadata.warnings || []

    // Explicit validation failure message from AI
    const validationError = !isValid ? (metadata.reason || "Document does not look correct.") : null

    // Only used for rendering fields, not storage
    // @ts-ignore
    const def = DOCUMENT_TYPES[docType] || {}

    // Reset when modal opens/closes
    useEffect(() => {
        if (!isOpen) {
            setFileToUpload(null)
            setMetadata({})
            setAnalyzing(false)
            setUploading(false)
            setIsValid(true)
            setOverride(false)
            setAiFailed(false)
        }
    }, [isOpen])

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0]
            setFileToUpload(file)

            try {
                setAnalyzing(true)

                // 1. Upload to storage to get a path for analysis
                const userId = (await supabase.auth.getUser()).data.user?.id
                if (!userId) throw new Error("User not found")

                const fileName = `${userId}/${category}/${docType}/${Date.now()}_${file.name}`
                const { error: uploadError } = await supabase.storage
                    .from('tenders_documents')
                    .upload(fileName, file)

                if (uploadError) throw uploadError

                // 2. Analyze
                // Pass validation rules from taxonomy definition
                const rules = (DOCUMENT_TYPES as any)[docType] || {}
                const { data, error: analyzeError } = await CompanyService.analyzeDocument(fileName, docType, rules)

                if (analyzeError || (data && data.code === "GENERAL" && data.description?.includes("AI Analysis unavailable"))) {
                    console.warn("AI Analysis failed or unavailable:", analyzeError || data)
                    setAiFailed(true)
                } else if (data) {
                    setAiFailed(false)
                    // Safe mapping: The AI sometimes returns a wrapped object { valid, metadata } or just { fields }
                    const rawPayload = data.metadata || data.fields || data
                    console.log("[AI Raw Extraction]:", rawPayload)
                    
                    const mappedData: any = {}
                    const normalizedAI: any = {}
                    
                    // Normalize all AI keys for flexible matching
                    Object.entries(rawPayload).forEach(([k, v]) => {
                        normalizedAI[k.toLowerCase().replace(/[_\s-]/g, '')] = v
                    })

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

                    console.log("[DEBUG 1] AI Raw Payload:", rawPayload)
                    console.log("[DEBUG 2] Normalized AI:", normalizedAI)
                    console.log("[DEBUG 3] Mapped Fields:", mappedData)

                    setMetadata(mappedData)

                    // Strict Validation Handling
                    if (data.valid === false) {
                        setIsValid(false)
                    } else {
                        setIsValid(true)
                    }
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
        if (!fileToUpload) return

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

            const { error } = await CompanyService.uploadComplianceDoc(fileToUpload, category, docType, finalMetadata)
            if (error) throw new Error(error)

            onSuccess()
            onClose()
        } catch (error) {
            console.error(error)
            alert("Failed to save document")
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
                    {existingDoc && !fileToUpload && (
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

                    {!fileToUpload ? (
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
                        <form onSubmit={handleSave} className="space-y-4">
                            {/* File Preview */}
                            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-700">
                                <FileText className="w-5 h-5 text-gray-400" />
                                <span className="truncate flex-1">{fileToUpload.name}</span>
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

                            {/* CRITICAL VALIDATION ERROR */}
                            {!isValid && (
                                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                                    <div className="flex items-start gap-3">
                                        <XCircle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
                                        <div className="space-y-2">
                                            <h4 className="text-sm font-bold text-red-900">Validation Failed</h4>
                                            <p className="text-sm text-red-800">{validationError}</p>

                                            <div className="pt-2 flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    id="override"
                                                    checked={override}
                                                    onChange={(e) => setOverride(e.target.checked)}
                                                    className="rounded border-red-300 text-red-600 focus:ring-red-500"
                                                />
                                                <label htmlFor="override" className="text-sm font-medium text-red-900 cursor-pointer">
                                                    I confirm this document is correct and want to force save.
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Dynamic Fields from Taxonomy */}
                            {'fields' in def && (def as any).fields?.map((field: any) => (
                                <div key={field.key}>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">{field.label}</label>

                                    {field.type === 'select' ? (
                                        <select
                                            required={field.required}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-primary focus:border-primary"
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
                                                required={field.required}
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
                                                    // Real-time date validation for expiry
                                                    if (field.key === 'expiry_date') {
                                                        const date = new Date(val)
                                                        if (new Date().getTime() > date.getTime()) {
                                                            setIsValid(false)
                                                            setMetadata((prev: any) => ({ ...prev, reason: "Document has already expired." }))
                                                        } else {
                                                            setIsValid(true)
                                                        }
                                                    }
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
                                    disabled={uploading || analyzing || (!isValid && !override)}
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
