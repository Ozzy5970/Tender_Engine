
import { useEffect, useState } from "react"
import { TemplateService, AdminService } from "@/services/api"
import { Archive, ChevronDown, ChevronRight, Calendar, CheckCircle, Clock, Trash2, Loader2 } from "lucide-react"
import { COMPLIANCE_CATEGORIES, DOCUMENT_TYPES } from "@/lib/taxonomy"

export default function AdminTemplateHistory() {
    const [templates, setTemplates] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({})

    useEffect(() => {
        loadHistory()
    }, [])

    const loadHistory = async () => {
        setLoading(true)
        // We want ALL templates, active and archived
        const success = await TemplateService.getAll(true)
        if (success.data) {
            setTemplates(success.data as any[])
            // Auto open all categories initially
            const allOpen = Object.keys(COMPLIANCE_CATEGORIES).reduce((acc, key) => ({ ...acc, [key]: true }), {})
            setOpenCategories({ ...allOpen, "General": true })
        }
        setLoading(false)
    }

    if (loading) return <div className="p-8"><Loader2 className="animate-spin" /></div>

    const toggleCategory = (cat: string) => {
        setOpenCategories(prev => ({ ...prev, [cat]: !prev[cat] }))
    }

    const handleDelete = async (id: string, url: string, isActive: boolean) => {
        const msg = isActive
            ? "⚠️ WARNING: This template is currently ACTIVE.\n\nDeleting it will remove it from the User Dashboard immediately. Are you sure?"
            : "Are you sure you want to permanently delete this archived template history?"

        if (confirm(msg)) {
            await AdminService.deleteTemplate(id, url)
            loadHistory()
        }
    }

    // Grouping Logic: Map DocTypes (e.g. 'cipc_cert') to Parent Categories (e.g. 'COMPANY')
    const grouped = templates.reduce((acc, t) => {
        let groupKey = t.category || "General"

        // If the category is actually a DocType Key, map it to the Parent Category
        // @ts-ignore
        if (DOCUMENT_TYPES[groupKey]) {
            // @ts-ignore
            groupKey = DOCUMENT_TYPES[groupKey].category
        }

        if (!acc[groupKey]) acc[groupKey] = []
        acc[groupKey].push(t)
        return acc
    }, {} as Record<string, any[]>)

    // Helper to format date
    const formatDate = (dateStr: string) => {
        if (!dateStr) return "-"
        return new Date(dateStr).toLocaleDateString('en-ZA', {
            year: 'numeric', month: 'short', day: '2-digit',
            hour: '2-digit', minute: '2-digit'
        })
    }

    // ... render methods ... 
    // inside renderCategoryBlock -> sortedItems.map...
    // <td className="px-6 py-3 text-right flex items-center justify-end gap-3">
    //    <button onClick={...} ...>View PDF</button>
    //    <button onClick={() => handleDelete(item.id, item.file_url, item.is_active)} ...><Trash2/></button>
    // </td>

    return (
        <div className="max-w-7xl mx-auto py-8 px-4 font-sans">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Template History</h1>
                <p className="text-gray-500 mt-1">
                    Complete reference log of all upload versions. Active templates are marked green.
                </p>
            </div>

            <div className="space-y-6">
                {/* General Section First */}
                {renderCategoryBlock("General", "Standard Bidding Documents (SBD)")}

                {/* Iterate Official Categories */}
                {Object.entries(COMPLIANCE_CATEGORIES).map(([key, label]) =>
                    renderCategoryBlock(key, label)
                )}
            </div>
        </div>
    )

    function renderCategoryBlock(key: string, label: string) {
        const items = grouped[key] || []
        const isOpen = openCategories[key]

        // Sort items: Active first, then by date desc
        const sortedItems = [...items].sort((a, b) => {
            // Sort by Created At Descending overall to show timeline
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        })

        if (items.length === 0) return null

        return (
            <div key={key} className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                <button
                    onClick={() => toggleCategory(key)}
                    className="w-full flex items-center justify-between px-6 py-4 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                >
                    <div className="flex items-center gap-3">
                        {isOpen ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
                        <span className="font-bold text-gray-800 text-lg">{label}</span>
                        <span className="bg-white border border-gray-200 text-xs font-mono px-2 py-0.5 rounded-full text-gray-500">
                            {items.length} Records
                        </span>
                    </div>
                </button>

                {isOpen && (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-white border-b border-gray-100 text-gray-400 uppercase text-xs font-semibold">
                                <tr>
                                    <th className="px-6 py-3">Status</th>
                                    <th className="px-6 py-3">Code</th>
                                    <th className="px-6 py-3">Template Title</th>
                                    <th className="px-6 py-3">Active From (Uploaded)</th>
                                    <th className="px-6 py-3">Active Until (Archived)</th>
                                    <th className="px-6 py-3 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {sortedItems.map(item => (
                                    <tr key={item.id} className={`hover:bg-blue-50/30 transition-colors ${!item.is_active ? 'bg-gray-50/50 text-gray-500' : ''}`}>
                                        <td className="px-6 py-3">
                                            {item.is_active ? (
                                                <span className="inline-flex items-center gap-1.5 bg-green-50 text-green-700 px-2.5 py-1 rounded-full text-xs font-bold border border-green-100">
                                                    <CheckCircle className="w-3 h-3" /> Active
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-500 px-2.5 py-1 rounded-full text-xs font-bold border border-gray-200">
                                                    <Archive className="w-3 h-3" /> Archived
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-3 font-mono text-xs">{item.code}</td>
                                        <td className="px-6 py-3 font-medium">
                                            {item.title}
                                            <div className="text-xs text-gray-400 font-normal mt-0.5 truncate max-w-xs">{item.description}</div>
                                        </td>
                                        <td className="px-6 py-3 text-gray-500 font-mono text-xs">
                                            <div className="flex items-center gap-2">
                                                <Calendar className="w-3 h-3 text-gray-300" />
                                                {formatDate(item.created_at)}
                                            </div>
                                        </td>
                                        <td className="px-6 py-3 text-gray-500 font-mono text-xs">
                                            {!item.is_active && item.archive_date ? (
                                                <div className="flex items-center gap-2 text-orange-600/70">
                                                    <Clock className="w-3 h-3" />
                                                    {formatDate(item.archive_date)}
                                                </div>
                                            ) : (
                                                <span className="text-gray-300">-</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-3 text-right">
                                            <div className="flex items-center justify-end gap-3">
                                                <button
                                                    onClick={async () => {
                                                        const url = await TemplateService.download(item)
                                                        window.open(url, '_blank')
                                                    }}
                                                    className="text-blue-600 hover:text-blue-800 hover:underline font-medium text-xs whitespace-nowrap"
                                                >
                                                    View PDF
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(item.id, item.file_url, item.is_active)}
                                                    className="text-gray-400 hover:text-red-600 transition-colors p-1 rounded hover:bg-red-50"
                                                    title="Delete permanently"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        )
    }
}
