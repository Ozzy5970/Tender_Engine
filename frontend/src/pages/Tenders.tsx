import { useState, useMemo } from "react"
import { Plus, FileText, ChevronRight, Loader2, AlertCircle, CheckCircle2, Search, Filter, Trash2, Lock } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { cn } from "@/lib/utils"
import { useFetch } from "@/hooks/useFetch"
import { TenderService } from "@/services/api"
import { useAuth } from "@/context/AuthContext"
import ConfirmationModal from "@/components/ConfirmationModal"
import { toast } from "sonner"

type TenderStatus = "processing" | "ready" | "error" | "draft"

interface Tender {
    id: string
    title: string
    client: string
    deadline: string
    status: TenderStatus
    readinessScore?: number
}

export default function Tenders() {
    const navigate = useNavigate()
    const { tier } = useAuth()

    const { data: apiTenders, loading, refetch } = useFetch(TenderService.getAll)
    const [deleteId, setDeleteId] = useState<string | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)

    // Using local state for now to demonstrate Filter/Search immediately
    const [tenders] = useState<Tender[]>([])

    // Search & Filter State
    const [searchQuery, setSearchQuery] = useState("")
    const [statusFilter, setStatusFilter] = useState<TenderStatus | "all">("all")

    const filteredTenders = useMemo(() => {
        // Prioritize API data if it exists and has items, otherwise fall back to mock data
        let data: Tender[] = (apiTenders && Array.isArray(apiTenders) && apiTenders.length > 0)
            ? (apiTenders as unknown as Tender[])
            : tenders

        return data.filter((t: Tender) => {
            const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                t.client.toLowerCase().includes(searchQuery.toLowerCase())
            const matchesStatus = statusFilter === "all" || t.status === statusFilter

            return matchesSearch && matchesStatus
        })
    }, [tenders, searchQuery, statusFilter, apiTenders])

    // --- TIER LIMIT LOGIC ---
    const TENDER_LIMITS = {
        'Free': 1,
        'Standard': 25,
        'Pro': Infinity
    }
    const currentLimit = TENDER_LIMITS[tier] || 1
    const currentCount = (apiTenders as any[])?.length || 0
    const isLimitReached = currentCount >= currentLimit
    const remaining = currentLimit === Infinity ? 999 : currentLimit - currentCount

    // Progress calculation (capped at 100%)
    const progressPercent = currentLimit === Infinity ? 0 : Math.min((currentCount / currentLimit) * 100, 100)

    const handleDelete = async () => {
        if (!deleteId) return
        setIsDeleting(true)
        try {
            await TenderService.deleteTender(deleteId)
            toast.success("Tender deleted successfully")
            refetch()
        } catch (error) {
            toast.error("Failed to delete tender")
        } finally {
            setIsDeleting(false)
            setDeleteId(null)
        }
    }

    const getStatusBadge = (status: TenderStatus) => {
        switch (status) {
            case "ready":
                return <div className="flex items-center text-green-700 bg-green-50 px-2 py-1 rounded-full text-xs font-medium"><CheckCircle2 className="w-3 h-3 mr-1" /> Ready</div>
            case "processing":
                return <div className="flex items-center text-blue-700 bg-blue-50 px-2 py-1 rounded-full text-xs font-medium"><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Processing</div>
            case "error":
                return <div className="flex items-center text-red-700 bg-red-50 px-2 py-1 rounded-full text-xs font-medium"><AlertCircle className="w-3 h-3 mr-1" /> Error</div>
            default:
                return <div className="flex items-center text-gray-700 bg-gray-50 px-2 py-1 rounded-full text-xs font-medium">Draft</div>
        }
    }

    if (loading) {
        return (
            <div className="max-w-5xl mx-auto space-y-6 pt-8">
                <div className="flex justify-between items-center mb-8">
                    <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
                    <div className="h-10 w-32 bg-gray-200 rounded animate-pulse" />
                </div>
                <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-24 bg-gray-50 rounded-xl border border-gray-100 animate-pulse" />
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900 mb-2">Tenders</h1>
                    <p className="text-sm text-gray-500">Manage your active tender opportunities.</p>
                </div>

                <div className="flex flex-col items-end gap-2">
                    <button
                        onClick={() => navigate("/tenders/new")}
                        disabled={isLimitReached}
                        className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium shadow-sm transition-all
                            ${isLimitReached
                                ? "bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200"
                                : "bg-primary text-white hover:bg-primary/90"}`}
                    >
                        {isLimitReached ? <Lock className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                        New Tender
                    </button>

                    {/* Tier Usage Indicator */}
                    {tier !== 'Pro' && (
                        <div className="flex flex-col items-end w-48">
                            <div className="flex justify-between w-full text-[10px] font-bold uppercase text-gray-500 mb-1">
                                <span>{tier} Plan Limit</span>
                                <span className={isLimitReached ? "text-red-500" : "text-gray-700"}>
                                    {currentCount} / {currentLimit} Used
                                </span>
                            </div>
                            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all duration-500 ${isLimitReached ? 'bg-red-500' : 'bg-blue-500'}`}
                                    style={{ width: `${progressPercent}%` }}
                                />
                            </div>
                            {isLimitReached && (
                                <button onClick={() => navigate('/settings?tab=billing')} className="text-[10px] text-primary hover:underline mt-1">Upgrade Limit</button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Search & Filter Bar */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search by title or client..."
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-primary focus:border-primary"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-gray-500" />
                    <select
                        className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-primary focus:border-primary bg-white"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as any)}
                    >
                        <option value="all">All Statuses</option>
                        <option value="ready">Ready</option>
                        <option value="processing">Processing</option>
                        <option value="error">Error</option>
                        <option value="draft">Draft</option>
                    </select>
                </div>
            </div>

            {/* Tender List */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                {filteredTenders.length === 0 ? (
                    <div className="text-center py-12">
                        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <FileText className="w-6 h-6 text-gray-400" />
                        </div>
                        <h3 className="text-sm font-medium text-gray-900">No tenders found</h3>
                        <p className="text-sm text-gray-500 mt-1">Try adjusting your filters or create a new tender.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {filteredTenders.map((tender: Tender) => (
                            <div
                                key={tender.id}
                                onClick={() => navigate(`/tenders/${tender.id}`)}
                                className="p-4 hover:bg-gray-50 transition-colors cursor-pointer flex items-center justify-between group"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="p-2 bg-gray-100 rounded-lg group-hover:bg-white group-hover:shadow-sm transition-all">
                                        <FileText className="w-6 h-6 text-gray-500" />
                                    </div>
                                    <div>
                                        <h3 className="font-medium text-gray-900">{tender.title}</h3>
                                        <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                                            <span>{tender.client}</span>
                                            <span>•</span>
                                            <span>Due: {tender.deadline}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-6">
                                    {tender.readinessScore !== undefined && tender.status === 'ready' && (
                                        <div className="flex flex-col items-end">
                                            <span className={cn(
                                                "text-sm font-bold",
                                                tender.readinessScore >= 80 ? "text-green-600" :
                                                    tender.readinessScore >= 50 ? "text-yellow-600" : "text-red-600"
                                            )}>
                                                {tender.readinessScore}%
                                            </span>
                                            <span className="text-[10px] text-gray-400 uppercase tracking-wide">Readiness</span>
                                        </div>
                                    )}

                                    <div className="min-w-[100px] flex justify-end">
                                        {getStatusBadge(tender.status)}
                                    </div>

                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            setDeleteId(tender.id)
                                        }}
                                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>

                                    <ChevronRight className="w-4 h-4 text-gray-300" />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <p className="text-center text-xs text-gray-400 mt-8">
                By using this platform, you agree to our Terms of Service. All readiness scores are advisory.
            </p>

            <ConfirmationModal
                isOpen={!!deleteId}
                onClose={() => setDeleteId(null)}
                onConfirm={handleDelete}
                title="Delete Tender"
                description="Are you sure you want to delete this tender? This action cannot be undone and all associated data including analysis will be permanently removed."
                confirmText="Delete Tender"
                variant="danger"
                loading={isDeleting}
            />
        </div>
    )
}
