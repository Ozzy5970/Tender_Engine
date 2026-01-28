import { useState } from "react"
import { CheckCircle2, AlertTriangle, XCircle, Upload, FileText, Loader2, Calendar, Trash2 } from "lucide-react"
import { CompanyService } from "@/services/api"
import { useFetch } from "@/hooks/useFetch"
import { supabase } from "@/lib/supabase"
import { COMPLIANCE_CATEGORIES, DOCUMENT_TYPES } from "@/lib/taxonomy"
import type { DocTypeKey } from "@/lib/taxonomy"
import DocumentUploadModal from "@/components/DocumentUploadModal"
import ConfirmationModal from "@/components/ConfirmationModal"
import { toast } from "sonner"

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

    // Delete Confirmation State
    const [deleteId, setDeleteId] = useState<string | null>(null)
    const [deleteLabel, setDeleteLabel] = useState<string>("")
    const [isDeleting, setIsDeleting] = useState(false)

    const handleDeleteClick = (id: string, label: string) => {
        setDeleteId(id)
        setDeleteLabel(label)
    }

    const confirmDelete = async () => {
        if (!deleteId) return
        setIsDeleting(true)
        try {
            await CompanyService.deleteComplianceDoc(deleteId)
            toast.success("Document deleted")
            refetch()
        } catch (error) {
            toast.error("Failed to delete document")
        } finally {
            setIsDeleting(false)
            setDeleteId(null)
        }
    }

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

    const getDaysRemaining = (expiryDate: string | null) => {
        if (!expiryDate) return null
        const today = new Date()
        const expiry = new Date(expiryDate)
        const diffTime = expiry.getTime() - today.getTime()
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    }

    // Temporary Test Data Injection
    const injectTestData = async () => {
        const confirm = window.confirm("This will clear your current documents and add test data (Expired, Expiring, Valid). Continue?")
        if (!confirm) return

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // clear
        await supabase.from('compliance_documents').delete().eq('user_id', user.id)

        // insert
        const today = new Date()
        const expiringDate = new Date(); expiringDate.setDate(today.getDate() + 50)
        const expiredDate = new Date(); expiredDate.setDate(today.getDate() - 10)
        const validDate = new Date(); validDate.setDate(today.getDate() + 200)

        await supabase.from('compliance_documents').insert([
            { user_id: user.id, category: 'CIPC', doc_type: 'cipc_cert', title: 'Test Expiring.pdf', file_name: 'Test Expiring.pdf', status: 'valid', expiry_date: expiringDate.toISOString(), metadata: {} },
            { user_id: user.id, category: 'SARS', doc_type: 'sars_pin', title: 'Test Expired.pdf', file_name: 'Test Expired.pdf', status: 'expired', expiry_date: expiredDate.toISOString(), metadata: {} },
            { user_id: user.id, category: 'COID', doc_type: 'coid_letter', title: 'Test Healthy.pdf', file_name: 'Test Healthy.pdf', status: 'valid', expiry_date: validDate.toISOString(), metadata: {} }
        ])

        toast.success("Test data injected! Refreshing...")
        refetch()
    }

    if (loading) return <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>

    return (
        <div className="max-w-5xl mx-auto space-y-8 pb-12">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900 mb-2">Compliance & Readiness</h1>
                    <p className="text-gray-500">Manage your diverse compliance portfolio for South African tenders.</p>
                </div>
                {import.meta.env.DEV && (
                    <button onClick={injectTestData} className="px-3 py-1 bg-gray-100 text-gray-600 text-xs rounded hover:bg-gray-200">
                        🛠️ Simulate Test Data
                    </button>
                )}
            </div>
            <div className="mt-4 p-4 rounded-r-lg border-l-4 border-blue-500 bg-white shadow-sm flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-blue-600" />
                <div>
                    <p className="font-bold text-gray-900">Company Compliance vs. Specific Tender Readiness</p>
                    <ul className="list-disc ml-4 mt-1 space-y-1 text-sm text-gray-600">
                        <li><b>Company Compliance (This Page):</b> Confirms your business is legally eligible to trade (Tax Pin, CIPC, VAT, etc.).</li>
                        <li><b>Tender Readiness:</b> Checks if you qualify for a <i>specific</i> job based on experience, grading, and pricing.</li>
                    </ul>
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
                                    // Override status logic for 90-day warning in UI
                                    const daysLeft = doc?.expiry_date ? getDaysRemaining(doc.expiry_date) : null
                                    const isExpiringSoon = daysLeft !== null && daysLeft <= 90 && daysLeft > 0

                                    // Use computed status but upgrade to warning if expiring soon and not already error
                                    let status = doc?.computed_status || (doc ? 'valid' : 'missing')
                                    if (isExpiringSoon && status === 'valid') status = 'warning'

                                    const isMissing = !doc

                                    return (
                                        <div key={typeKey} className="p-6 flex items-start gap-4 hover:bg-gray-50/50 transition-colors">
                                            <div className="mt-1 relative">
                                                {getStatusIcon(status)}
                                                {isExpiringSoon && (
                                                    <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                                                    </span>
                                                )}
                                            </div>

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
                                                            <span className={`flex items-center gap-1 ${status === 'expired' ? 'text-red-600 font-bold' : (isExpiringSoon ? 'text-amber-600 font-bold' : '')}`}>
                                                                <Calendar className="w-3.5 h-3.5" />
                                                                {status === 'expired'
                                                                    ? `Expired ${Math.abs(daysLeft || 0)} days ago`
                                                                    : (isExpiringSoon ? `Expires in ${daysLeft} days` : `Exp: ${doc.expiry_date}`)
                                                                }
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
                                                <div className="flex items-center gap-2">
                                                    {!isMissing && doc?.id && (
                                                        <button
                                                            onClick={() => handleDeleteClick(doc.id, def.label)}
                                                            className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100 transition-colors"
                                                            title="Delete Document"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    )}
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

            <ConfirmationModal
                isOpen={!!deleteId}
                onClose={() => setDeleteId(null)}
                onConfirm={confirmDelete}
                title={`Delete ${deleteLabel}?`}
                description="Are you sure you want to delete this document? You will need to re-upload it to maintain compliance."
                confirmText="Delete Document"
                variant="danger"
                loading={isDeleting}
            />
        </div >
    )
}
