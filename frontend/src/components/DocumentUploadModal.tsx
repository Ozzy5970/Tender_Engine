
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

                if (data) {

                    setMetadata((prev: any) => ({
                        ...prev,
                        ...data,
                        expiryDate: data.expiry_date || prev.expiryDate,
                    }))

                    // Strict Validation Handling
                    if (data.valid === false) {
                        setIsValid(false)
                    } else {
                        setIsValid(true)
                    }
                } else if (analyzeError) {
                    console.warn("AI Analysis failed:", analyzeError)
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
            // Re-upload/Update metadata record (api.ts uploadComplianceDoc will re-upload logic or we can refactor)
            // Ideally we separate "save metadata" from "upload file".
            // Since uploadComplianceDoc takes a File, it re-uploads.
            // This is acceptable for V1 MVP to ensure consistent pathing in DB.
            const { error } = await CompanyService.uploadComplianceDoc(fileToUpload, category, docType, metadata)
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
                                ) : (
                                    <div className="flex items-center text-green-600 text-xs font-medium">
                                        <Sparkles className="w-4 h-4 mr-1" />
                                        AI Analyzed
                                    </div>
                                )}
                            </div>

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

                            {/* Expiry Date (Strict Future Check) */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date</label>
                                <input
                                    type="date"
                                    required
                                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-primary focus:border-primary ${metadata.expiryDate && new Date(metadata.expiryDate) < new Date() ? 'border-red-300 bg-red-50 text-red-900' : 'border-gray-300'
                                        }`}
                                    value={metadata.expiryDate || ""}
                                    onChange={(e) => {
                                        setMetadata({ ...metadata, expiryDate: e.target.value })
                                        // Real-time check
                                        const date = new Date(e.target.value)
                                        const now = new Date()
                                        if (date < now) {
                                            // Soft block - we set isValid to false but user can override if strictly needed (handled by isValid logic above)
                                            setIsValid(false)
                                            setMetadata((prev: any) => ({ ...prev, reason: "Document has already expired." }))
                                        } else {
                                            setIsValid(true)
                                        }
                                    }}
                                />
                                {metadata.expiryDate && new Date(metadata.expiryDate) < new Date() && (
                                    <p className="text-xs text-red-600 mt-1 font-medium">Warning: This date is in the past.</p>
                                )}
                            </div>

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
                                        <input
                                            type={field.type || "text"}
                                            required={field.required}
                                            placeholder={field.placeholder}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-primary focus:border-primary"
                                            value={metadata[field.key] || ""}
                                            onChange={(e) => setMetadata({ ...metadata, [field.key]: e.target.value })}
                                        />
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
