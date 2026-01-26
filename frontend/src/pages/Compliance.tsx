import { useState } from "react"
import { CheckCircle2, AlertTriangle, XCircle, Upload, FileText, Loader2, Calendar } from "lucide-react"
import { CompanyService } from "@/services/api"
import { useFetch } from "@/hooks/useFetch"
import { COMPLIANCE_CATEGORIES, DOCUMENT_TYPES } from "@/lib/taxonomy"
import type { DocTypeKey } from "@/lib/taxonomy"
import DocumentUploadModal from "@/components/DocumentUploadModal"

interface ComplianceDocument {
    id: string
    doc_type: string
    computed_status: string
    file_name: string
    expiry_date: string | null
    metadata: Record<string, any>
}

export default function Compliance() {
    const { data: apiDocs, loading, refetch } = useFetch(CompanyService.getCompliance, [])

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [selectedDocType, setSelectedDocType] = useState<DocTypeKey | null>(null)
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

    const getStatusIcon = (status: string) => {
        switch (status) {
            case "valid": return <CheckCircle2 className="w-5 h-5 text-green-600" />
            case "warning": return <AlertTriangle className="w-5 h-5 text-yellow-600" />
            case "expired": return <XCircle className="w-5 h-5 text-red-600" />
            case "missing": return <div className="w-5 h-5 rounded-full border-2 border-gray-300 border-dashed" />
            default: return <div className="w-5 h-5" />
        }
    }

    const findDoc = (typeKey: string): ComplianceDocument | undefined => {
        if (!apiDocs) return undefined
        return (apiDocs as any[]).find((d: any) => d.doc_type === typeKey)
    }

    if (loading) return <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>

    return (
        <div className="max-w-5xl mx-auto space-y-8 pb-12">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Compliance & Readiness</h1>
                <p className="text-gray-500">Manage your diverse compliance portfolio for South African tenders.</p>
                <div className="mt-4 p-4 bg-blue-50 text-blue-800 rounded-lg text-sm border border-blue-100 flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                    <div>
                        <p className="font-bold">Company Compliance vs. Specific Tender Readiness</p>
                        <ul className="list-disc ml-4 mt-1 space-y-1 text-blue-700/80">
                            <li><b>Company Compliance (This Page):</b> Confirms your business is legally eligible to trade (Tax Pin, CIPC, VAT, etc.).</li>
                            <li><b>Tender Readiness:</b> Checks if you qualify for a <i>specific</i> job based on experience, grading, and pricing.</li>
                        </ul>
                    </div>
                </div>
            </div>

            <div className="space-y-6">
                {Object.entries(COMPLIANCE_CATEGORIES).map(([catKey, catLabel]) => {
                    const typeEntries = Object.entries(DOCUMENT_TYPES).filter(([_, def]) => def.category === catKey)
                    if (typeEntries.length === 0) return null

                    return (
                        <div key={catKey} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                                <h3 className="font-semibold text-gray-900">{catLabel}</h3>
                                <span className="text-xs bg-white border border-gray-200 px-2 py-1 rounded text-gray-500">
                                    {typeEntries.length} Required
                                </span>
                            </div>

                            <div className="divide-y divide-gray-100">
                                {typeEntries.map(([typeKey, def]) => {
                                    const doc = findDoc(typeKey)
                                    const status = doc?.computed_status || (doc ? 'valid' : 'missing')
                                    const isMissing = !doc

                                    return (
                                        <div key={typeKey} className="p-6 flex items-start gap-4 hover:bg-gray-50/50 transition-colors">
                                            <div className="mt-1">{getStatusIcon(status)}</div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <h4 className="font-medium text-gray-900">{def.label}</h4>
                                                    {def.mandatory && <span className="text-[10px] uppercase tracking-wider text-red-600 font-bold bg-red-50 px-1.5 py-0.5 rounded">Required</span>}
                                                </div>

                                                {doc ? (
                                                    <div className="mt-1 flex items-center gap-4 text-sm text-gray-600">
                                                        <span className="flex items-center gap-1">
                                                            <FileText className="w-3.5 h-3.5" />
                                                            {doc.file_name || "Document Uploaded"}
                                                        </span>
                                                        {doc.expiry_date && (
                                                            <span className={`flex items-center gap-1 ${status === 'expired' ? 'text-red-600 font-medium' : ''}`}>
                                                                <Calendar className="w-3.5 h-3.5" />
                                                                Exp: {doc.expiry_date}
                                                            </span>
                                                        )}
                                                        {(def as any).wMetadata?.includes('grade') && doc.metadata?.grade && (
                                                            <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs font-medium border border-blue-100">
                                                                Grade {doc.metadata.grade}
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <p className="mt-1 text-sm text-gray-400">No document uploaded yet.</p>
                                                )}
                                            </div>

                                            <div>
                                                <button
                                                    onClick={() => {
                                                        setSelectedDocType(typeKey as DocTypeKey)
                                                        setSelectedCategory(catKey)
                                                        setIsModalOpen(true)
                                                    }}
                                                    className={`flex items-center px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border shadow-sm ${isMissing
                                                        ? 'bg-white text-primary border-primary hover:bg-primary hover:text-white'
                                                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                                        }`}>
                                                    <Upload className="w-4 h-4 mr-2" />
                                                    {isMissing ? 'Upload' : 'Replace'}
                                                </button>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )
                })}
            </div>

            <DocumentUploadModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={refetch}
                category={selectedCategory || "General"}
                docType={selectedDocType || ""}
                title={selectedDocType ? DOCUMENT_TYPES[selectedDocType]?.label : "Document"}
                existingDoc={!!(selectedDocType && findDoc(selectedDocType))}
            />
        </div>
    )
}
